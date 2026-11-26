using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Net;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;

namespace LastSignal {
    internal sealed class ManagedAdmission {
        public string Invite;
        public CookieContainer Access;
    }

    internal sealed class ManagedDirectory {
        const string Documents="projects/magic-servers-1ca0c/databases/(default)/documents";
        const string Parent=Documents+"/managedGameDirectories/lastsignal";
        const string Api="https://firestore.googleapis.com/v1/"+Parent;
        static readonly Regex Origin=new Regex(@"\Ahttps://[a-z0-9]+(?:-[a-z0-9]+)*\.trycloudflare\.com\z");
        static readonly Regex Pin=new Regex(@"\A[0-9]{4}\z");
        readonly Func<string,string,object,string,object> request;
        readonly Func<string,string,CookieContainer,string> admit;
        internal ManagedDirectory():this(OnlineDirectory.Request,Gateway){}
        internal ManagedDirectory(Func<string,string,object,string,object> request,Func<string,string,CookieContainer,string> admit){
            this.request=request;this.admit=admit;
        }

        static bool TimeField(object fields,string key,out DateTime value) {
            return DateTime.TryParse(OnlineDirectory.Field(fields,key,"timestampValue"),CultureInfo.InvariantCulture,
                DateTimeStyles.AdjustToUniversal|DateTimeStyles.AssumeUniversal,out value);
        }
        static bool Number(object fields,string key,out int value) {
            return int.TryParse(OnlineDirectory.Field(fields,key,"integerValue"),NumberStyles.None,CultureInfo.InvariantCulture,out value);
        }
        static bool ValidCounts(int players,int capacity,int queued) {
            return capacity==8&&players>=0&&players<=capacity&&queued>=0&&queued<=1000;
        }
        static bool PhaseValid(string value){return value=="waiting"||value=="playing"||value=="finished";}
        internal static OnlineRoom Parse(object document,DateTime now){
            string path=OnlineDirectory.S(document,"name"),prefix=Parent+"/lobbies/";
            if(!path.StartsWith(prefix,StringComparison.Ordinal))return null;
            string code=path.Substring(prefix.Length);
            object fields=OnlineDirectory.At(document,"fields");
            string origin=OnlineDirectory.Field(fields,"origin","stringValue");
            string hostId=OnlineDirectory.Field(fields,"hostId","stringValue");
            string name=OnlineDirectory.Field(fields,"name","stringValue");
            string visibility=OnlineDirectory.Field(fields,"visibility","stringValue");
            string phase=OnlineDirectory.Field(fields,"phase","stringValue");
            DateTime updated,expires;int players,capacity,queued;
            if(!Pin.IsMatch(code)||!Origin.IsMatch(origin)||hostId.Length==0||hostId.Length>128||
                string.IsNullOrWhiteSpace(name)||name.Length>40||name.Any(char.IsControl)||(visibility!="public"&&visibility!="code")||
                OnlineDirectory.Field(fields,"joinUrl","stringValue")!=origin+"/__catnmice/join"||!PhaseValid(phase)||
                !TimeField(fields,"updatedAt",out updated)||!TimeField(fields,"expiresAt",out expires)||expires<=now||expires<=updated||
                expires>now.AddMinutes(3)||updated<now.AddMinutes(-3)||updated>now.AddSeconds(30)||
                !Number(fields,"players",out players)||!Number(fields,"capacity",out capacity)||!Number(fields,"queued",out queued)||
                !ValidCounts(players,capacity,queued))return null;
            return new OnlineRoom{Name=name,ManagedOrigin=origin,HostId=hostId,Visibility=visibility,ServerCode=code,
                Phase=phase,Humans=players,Capacity=capacity,Queued=queued,Expires=expires};
        }
        static IEnumerable<OnlineRoom> Rank(IEnumerable<OnlineRoom> source){
            return source.OrderByDescending(room=>room.Phase=="waiting").ThenByDescending(room=>room.Capacity-room.Humans-room.Queued)
                .ThenBy(room=>room.Queued).ThenBy(room=>room.Name,StringComparer.OrdinalIgnoreCase).ThenBy(room=>room.ServerCode);
        }
        internal OnlineRoom[] List(CancellationToken cancel){
            var rooms=new List<OnlineRoom>();string cursor=null;
            var timer=Stopwatch.StartNew();
            do {
                cancel.ThrowIfCancellationRequested();
                if(timer.Elapsed.TotalSeconds>12)throw new IOException("The server list timed out. Refresh it to try again.");
                var query=new Dictionary<string,object>{
                    {"from",new[]{new{collectionId="lobbies"}}},
                    {"where",new{fieldFilter=new{field=new{fieldPath="visibility"},op="EQUAL",value=new{stringValue="public"}}}},
                    {"orderBy",new[]{new{field=new{fieldPath="__name__"},direction="ASCENDING"}}},{"limit",25}
                };
                if(cursor!=null)query["startAt"]=new{values=new[]{new{referenceValue=cursor}},before=false};
                var rows=request(Api+":runQuery","POST",new{structuredQuery=query},null) as object[];
                if(rows==null)throw new IOException("The server directory returned an invalid response.");
                string next=null;int count=0;
                foreach(object row in rows){
                    object doc=OnlineDirectory.At(row,"document");if(doc==null)continue;
                    count++;next=OnlineDirectory.S(doc,"name");
                    var item=Parse(doc,DateTime.UtcNow);if(item!=null&&item.Visibility=="public")rooms.Add(item);
                }
                if(count<25)break;
                if(next==null||!next.StartsWith(Parent+"/lobbies/",StringComparison.Ordinal)||String.CompareOrdinal(next,cursor)<=0)
                    throw new IOException("The server directory returned an invalid page.");
                cursor=next;
            } while(true);
            return Rank(rooms).ToArray();
        }
        OnlineRoom Probe(OnlineRoom room){
            if(room.Expires<=DateTime.UtcNow)return null;
            object live=request(room.ManagedOrigin+"/__catnmice/status","GET",null,null);
            string phase=OnlineDirectory.S(live,"phase");
            if(OnlineDirectory.S(live,"game")!="lastsignal"||OnlineDirectory.S(live,"hostId")!=room.HostId||
                OnlineDirectory.S(live,"visibility")!=room.Visibility||!PhaseValid(phase)||phase=="finished"||
                !Object.Equals(OnlineDirectory.At(live,"joinable"),true))return null;
            var players=OnlineDirectory.At(live,"players") as int?;
            var capacity=OnlineDirectory.At(live,"capacity") as int?;
            var queued=OnlineDirectory.At(live,"queued") as int?;
            if(!players.HasValue||!capacity.HasValue||!queued.HasValue||!ValidCounts(players.Value,capacity.Value,queued.Value)||players>=capacity)return null;
            // Clone the listing because the browser may still be rendering its directory snapshot.
            return new OnlineRoom{Name=room.Name,HostId=room.HostId,ManagedOrigin=room.ManagedOrigin,ServerCode=room.ServerCode,
                Visibility=room.Visibility,Expires=room.Expires,Phase=phase,Humans=players.Value,Capacity=capacity.Value,Queued=queued.Value};
        }
        ManagedAdmission Open(OnlineRoom room){
            var jar=new CookieContainer();
            string location=admit(room.ManagedOrigin,room.Visibility=="code"?room.ServerCode:null,jar);
            Uri address;
            if(String.IsNullOrEmpty(location)||!location.StartsWith("/mobile/",StringComparison.Ordinal)||
                !Uri.TryCreate(new Uri(room.ManagedOrigin),location,out address)||address.GetLeftPart(UriPartial.Authority)!=room.ManagedOrigin||
                address.AbsolutePath!="/mobile/"||!Regex.IsMatch(address.Fragment,@"\A#[A-Za-z0-9_-]{24}\z"))
                throw new IOException("The server returned an invalid arena invite.");
            return new ManagedAdmission{Invite=room.ManagedOrigin+"/"+address.Fragment,Access=jar};
        }
        internal ManagedAdmission Join(OnlineRoom selected,string pin,CancellationToken cancel){
            cancel.ThrowIfCancellationRequested();
            if(pin!=null){
                if(!Pin.IsMatch(pin))throw new IOException("Enter the four-digit server code.");
                selected=Parse(request(Api+"/lobbies/"+pin,"GET",null,null),DateTime.UtcNow);
                if(selected==null||selected.ServerCode!=pin||selected.Visibility!="code")throw new IOException("No private server has that code.");
            }
            var live=selected==null?null:Probe(selected);
            if(live==null)throw new IOException("This arena is full, in play or offline.");
            cancel.ThrowIfCancellationRequested();
            return Open(live);
        }
        internal ManagedAdmission Live(CancellationToken cancel){
            var rooms=List(cancel);var timer=Stopwatch.StartNew();
            var fallback=new List<OnlineRoom>();
            for(int offset=0;offset<rooms.Length&&timer.Elapsed.TotalSeconds<12;offset+=5){
                cancel.ThrowIfCancellationRequested();
                var live=new List<OnlineRoom>();
                Parallel.ForEach(rooms.Skip(offset).Take(5),new ParallelOptions{CancellationToken=cancel,MaxDegreeOfParallelism=5},item=>{
                    try{var verified=Probe(item);if(verified!=null)lock(live)live.Add(verified);}
                    catch(WebException error){if(error.Response!=null)error.Response.Close();}
                    catch(IOException){}catch(ArgumentException){}catch(InvalidOperationException){}
                });
                foreach(var room in Rank(live)){
                    if(room.Phase!="waiting"){fallback.Add(room);continue;}
                    cancel.ThrowIfCancellationRequested();
                    if(timer.Elapsed.TotalSeconds>=12)break;
                    try{return Open(room);}catch(WebException error){if(error.Response!=null)error.Response.Close();}catch(IOException){}
                }
            }
            foreach(var room in Rank(fallback)){
                cancel.ThrowIfCancellationRequested();
                if(timer.Elapsed.TotalSeconds>=12)break;
                try{return Open(room);}catch(WebException error){if(error.Response!=null)error.Response.Close();}catch(IOException){}
            }
            throw new IOException("No public arena has an open seat.");
        }
        internal static string Gateway(string origin,string pin,CookieContainer jar){
            ServicePointManager.SecurityProtocol|=SecurityProtocolType.Tls12;
            if(pin!=null){
                var access=GatewayRequest(origin+"/__catnmice/access",jar);
                access.Method="POST";access.ContentType="application/json";
                byte[] payload=Encoding.ASCII.GetBytes("{\"code\":\""+pin+"\"}");
                access.ContentLength=payload.Length;
                using(var stream=access.GetRequestStream())stream.Write(payload,0,payload.Length);
                using(var reply=(HttpWebResponse)access.GetResponse())
                    if(reply.StatusCode!=HttpStatusCode.NoContent||jar.GetCookies(new Uri(origin)).Count==0)
                        throw new IOException("The server did not accept the join code.");
            }
            var join=GatewayRequest(origin+"/__catnmice/join",jar);
            using(var reply=(HttpWebResponse)join.GetResponse()){
                if(reply.StatusCode!=HttpStatusCode.Redirect)throw new IOException("The server could not admit this contestant.");
                return reply.Headers[HttpResponseHeader.Location];
            }
        }
        static HttpWebRequest GatewayRequest(string url,CookieContainer jar){
            var req=(HttpWebRequest)WebRequest.Create(url);req.AllowAutoRedirect=false;req.CookieContainer=jar;
            req.Timeout=req.ReadWriteTimeout=4500;return req;
        }
    }
}
