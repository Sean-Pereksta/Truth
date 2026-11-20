using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Net;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Web.Script.Serialization;

namespace LastSignal
{
    public sealed class OnlineRoom
    {
        public string Name, Invite, Arena;
        public int Humans;
        internal DateTime Expires;
        internal string ManagedOrigin, HostId, Visibility, ServerCode, Phase;
        internal int Capacity, Queued;
    }

    // Discovery publishes only a revocable public lobby ID. Private invitations
    // and in-game traffic stay between the contestants and their arena host.
    public sealed class OnlineDirectory : IDisposable
    {
        const string Root = "https://firestore.googleapis.com/v1/projects/bible-game-246c0/databases/(default)/documents";
        const string Auth = "https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=AIzaSyB7twY7z31ucB6pGA8JC_HrVMZhA8lNaJA";
        const string Token = "https://securetoken.googleapis.com/v1/token?key=AIzaSyB7twY7z31ucB6pGA8JC_HrVMZhA8lNaJA";
        const string Kind = "lastsignal-arena-v1";
        static readonly Regex Host = new Regex(@"^https://[a-z0-9-]+\.trycloudflare\.com$",RegexOptions.CultureInvariant);
        static readonly Regex Code = new Regex(@"^[A-Za-z0-9_-]{24}$",RegexOptions.CultureInvariant);
        readonly object gate=new object(), login=new object();
        readonly Func<string,string,object,string,object> request;
        string uid, token, refresh, origin, roomId, name, arena;
        int count, revision;
        DateTime renew, nextWrite;
        bool publishing, reading, listed, disposed;
        volatile string hostStatus="", browseStatus="Refresh to see public arenas.";
        OnlineRoom[] rooms=new OnlineRoom[0];
        public string HostStatus { get {return hostStatus;} }
        public string BrowseStatus { get {return browseStatus;} }
        public OnlineDirectory():this(Request){}
        internal OnlineDirectory(Func<string,string,object,string,object> request){this.request=request;}
        public OnlineRoom[] Rooms {
            get {
                lock(gate){
                    foreach(var room in rooms)if(room.Expires<=DateTime.UtcNow){
                        rooms=Array.FindAll(rooms,x=>x.Expires>DateTime.UtcNow);break;
                    }
                    return rooms;
                }
            }
        }

        internal static object Request(string url,string method,object body,string bearer)
        {
            ServicePointManager.SecurityProtocol|=SecurityProtocolType.Tls12;
            var json=new JavaScriptSerializer{MaxJsonLength=512*1024,RecursionLimit=24};
            var req=(HttpWebRequest)WebRequest.Create(url);
            req.Method=method;req.Timeout=6500;req.ReadWriteTimeout=6500;req.AllowAutoRedirect=false;
            if(!string.IsNullOrEmpty(bearer))req.Headers["Authorization"]="Bearer "+bearer;
            if(body!=null){
                bool form=body is string;
                byte[] bytes=Encoding.UTF8.GetBytes(form?(string)body:json.Serialize(body));
                req.ContentType=form?"application/x-www-form-urlencoded":"application/json";
                req.ContentLength=bytes.Length;
                using(var stream=req.GetRequestStream())stream.Write(bytes,0,bytes.Length);
            }
            using(var response=(HttpWebResponse)req.GetResponse())
            using(var stream=response.GetResponseStream())
            using(var reader=new StreamReader(stream,Encoding.UTF8)){
                var data=new StringBuilder();
                var buffer=new char[4096];int read;
                while((read=reader.Read(buffer,0,buffer.Length))!=0){
                    if(data.Length+read>512*1024)throw new IOException("The lobby directory response was too large.");
                    data.Append(buffer,0,read);
                }
                return data.Length==0?null:json.DeserializeObject(data.ToString());
            }
        }
        internal static object At(object obj,string key){
            object value;var row=obj as Dictionary<string,object>;
            return row!=null && row.TryGetValue(key,out value)?value:null;
        }
        internal static string S(object obj,string key){return At(obj,key) as string??"";}
        string Authorize(){
            lock(login){
                if(token!=null && renew>DateTime.UtcNow)return token;
                object auth;
                if(refresh==null){
                    auth=request(Auth,"POST",new{returnSecureToken=true},null);
                    uid=S(auth,"localId");token=S(auth,"idToken");refresh=S(auth,"refreshToken");
                }else{
                    auth=request(Token,"POST","grant_type=refresh_token&refresh_token="+Uri.EscapeDataString(refresh),null);
                    if(uid!=S(auth,"user_id"))throw new IOException("Directory identity changed.");
                    token=S(auth,"id_token");refresh=S(auth,"refresh_token");
                }
                if(!Regex.IsMatch(uid,@"^[A-Za-z0-9_-]{1,100}$")||string.IsNullOrEmpty(token)||string.IsNullOrEmpty(refresh))
                    throw new IOException("The lobby directory could not sign in.");
                renew=DateTime.UtcNow.AddMinutes(50);
                return token;
            }
        }
        static string Utc(DateTime value){return value.ToString("yyyy-MM-ddTHH:mm:ss.fffZ",CultureInfo.InvariantCulture);}
        public void Refresh(){
            lock(gate){if(disposed||reading)return;reading=true;browseStatus="Looking for public arenas…";}
            ThreadPool.QueueUserWorkItem(delegate{
                try{
                    var cutoff=DateTime.UtcNow.AddSeconds(-90);
                    var field=new{fieldPath="lastSignalListedAt"};
                    var query=new{structuredQuery=new{
                        from=new[]{new{collectionId="lobbies"}},
                        where=new{fieldFilter=new{field=field,op="GREATER_THAN",value=new{timestampValue=Utc(cutoff)}}},
                        orderBy=new[]{new{field=field,direction="DESCENDING"}},limit=50}};
                    var entries=request(Root+":runQuery","POST",query,Authorize()) as object[];
                    var found=new List<OnlineRoom>();
                    foreach(var row in entries??new object[0]){
                        var room=Parse(At(row,"document"),DateTime.UtcNow);
                        if(room!=null)found.Add(room);
                    }
                    lock(gate){rooms=found.ToArray();browseStatus=rooms.Length==0?"No public arenas are waiting.":"Choose an arena to join.";}
                }catch(Exception){browseStatus="Could not reach the public directory. Retry or paste an invitation.";}
                finally{lock(gate)reading=false;}
            });
        }
        internal static string Field(object fields,string key,string type){return S(At(fields,key),type);}
        internal static OnlineRoom Parse(object document,DateTime now){
            object f=At(document,"fields");
            string code=Field(f,"publicRoom","stringValue"), site=Field(f,"origin","stringValue");
            if(Field(f,"gameType","stringValue")!=Kind||!Code.IsMatch(code)||!Host.IsMatch(site))return null;
            string owner=Field(f,"ownerUid","stringValue");
            if(!Regex.IsMatch(owner,@"^[A-Za-z0-9_-]{1,100}$")||!S(document,"name").EndsWith("/lobbies/lastsignal-"+owner,StringComparison.Ordinal))return null;
            DateTime stamp;int humans;
            if(!DateTime.TryParse(Field(f,"lastSignalListedAt","timestampValue"),CultureInfo.InvariantCulture,DateTimeStyles.AdjustToUniversal|DateTimeStyles.AssumeUniversal,out stamp)||
                stamp<=now.AddSeconds(-90)||stamp>now.AddSeconds(30)||
                !int.TryParse(Field(f,"humans","integerValue"),out humans)||humans<1||humans>=8)return null;
            return new OnlineRoom{Name=OnlineWire.Name(Field(f,"hostName","stringValue")),Arena=OnlineWire.Name(Field(f,"arena","stringValue")),
                Humans=humans,Invite=site+"/#"+code,Expires=stamp.AddSeconds(90)};
        }
        public void Update(string hostOrigin,string publicId,string hostName,int humans,string arenaName){
            lock(gate){
                if(disposed)return;
                if(humans<1||humans>=8){Unlist();return;}
                bool changed=origin!=hostOrigin||roomId!=publicId||count!=humans||name!=hostName||arena!=arenaName;
                if(changed){
                    if(string.IsNullOrEmpty(hostOrigin)||string.IsNullOrEmpty(publicId)||!Host.IsMatch(hostOrigin)||!Code.IsMatch(publicId)){Unlist();return;}
                    origin=hostOrigin;roomId=publicId;count=humans;name=hostName;arena=arenaName;
                    revision++;nextWrite=DateTime.MinValue;
                }
                if(!publishing && DateTime.UtcNow>=nextWrite)StartWriter();
            }
        }
        public void Unlist(){
            lock(gate){
                if(origin!=null){origin=roomId=null;revision++;nextWrite=DateTime.MinValue;hostStatus="";}
                if(!publishing && listed && DateTime.UtcNow>=nextWrite)StartWriter();
            }
        }
        void StartWriter(){
            publishing=true;
            ThreadPool.QueueUserWorkItem(delegate{Publish();});
        }
        void Publish(){
            for(;;){
                string currentOrigin,code,host,map;int people,version;
                lock(gate){currentOrigin=origin;code=roomId;people=count;host=name;map=arena;version=revision;}
                bool success=false;
                try{
                    var credential=Authorize();
                    string doc="projects/bible-game-246c0/databases/(default)/documents/lobbies/lastsignal-"+uid;
                    if(currentOrigin==null){
                        try{request("https://firestore.googleapis.com/v1/"+doc,"DELETE",null,credential);}
                        catch(WebException e){using(var response=e.Response as HttpWebResponse){if(response==null||response.StatusCode!=HttpStatusCode.NotFound)throw;}}
                    }else{
                        lock(gate)if(version==revision)hostStatus="Listing the arena…";
                        var fields=new{gameType=new{stringValue=Kind},publicRoom=new{stringValue=code},ownerUid=new{stringValue=uid},
                            hostName=new{stringValue=host},origin=new{stringValue=currentOrigin},arena=new{stringValue=map},humans=new{integerValue=people.ToString(CultureInfo.InvariantCulture)}};
                        var record=new{writes=new[]{new{update=new{name=doc,fields=fields},updateTransforms=new[]{new{fieldPath="lastSignalListedAt",setToServerValue="REQUEST_TIME"}}}}};
                        request(Root+":commit","POST",record,credential);
                    }
                    success=true;
                }catch(Exception){ }
                lock(gate){
                    if(success)listed=currentOrigin!=null;
                    if(version!=revision)continue;
                    hostStatus=currentOrigin==null?"":success?"Listed in public arenas.":"Directory unavailable. You can still share your invite.";
                    nextWrite=DateTime.UtcNow.AddSeconds(30);publishing=false;return;
                }
            }
        }
        public void Dispose(){lock(gate){disposed=true;Unlist();}}
    }
}
