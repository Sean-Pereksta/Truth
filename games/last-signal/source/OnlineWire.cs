using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;

namespace LastSignal {
    internal static class OnlineWire {
        internal const string Version="LS1";
        static readonly UTF8Encoding Utf8=new UTF8Encoding(false,true);
        internal static string Token(){
            byte[] data=new byte[18];
            using(var rng=RandomNumberGenerator.Create())rng.GetBytes(data);
            return Convert.ToBase64String(data).TrimEnd('=').Replace('+','-').Replace('/','_');
        }
        internal static string Name(string text){
            var result=new StringBuilder(20);
            foreach(char c in (text??"").Trim()){
                if(result.Length==20)break;
                if(char.IsLetterOrDigit(c)||c==' '||c=='_'||c=='-'||c=='.')result.Append(c);
            }
            string name=result.ToString().Trim();
            return name.Length==0?"Contestant":name;
        }
        internal static bool Invite(string value,out string url,out string key){
            url=key="";
            Uri u;
            if(value==null||value.Length>2048||!Uri.TryCreate(value.Trim(),UriKind.Absolute,out u))return false;
            bool tls=u.Scheme=="https"||u.Scheme=="wss",plain=u.Scheme=="http"||u.Scheme=="ws";
            if(!tls&&!(plain&&u.IsLoopback)||u.UserInfo.Length!=0||u.Query.Length!=0||u.Fragment.Length!=25 ||
               (u.AbsolutePath!="/"&&u.AbsolutePath!="/ws"))return false;
            key=u.Fragment.Substring(1);
            foreach(char c in key)if(!(c>='A'&&c<='Z'||c>='a'&&c<='z'||c>='0'&&c<='9'||c=='-'||c=='_'))return false;
            var b=new UriBuilder(u){Scheme=tls?"wss":"ws",Path="/ws",Fragment="",Query="",Port=u.IsDefaultPort?-1:u.Port};
            url=b.Uri.AbsoluteUri;return true;
        }
        internal static byte[] Input(int round,OnlinePlayerInput input){
            using(var stream=new MemoryStream(128))using(var w=new BinaryWriter(stream,Utf8)){
                w.Write((byte)1);w.Write(round);w.Write(input.Sequence);
                w.Write(input.Right);w.Write(input.Forward);w.Write(input.Lean);w.Write(input.Yaw);w.Write(input.Pitch);
                w.Write((byte)((input.Sprint?1:0)|(input.Crouch?2:0)));
                w.Write((byte)input.Actions.Count);
                foreach(string action in input.Actions){
                    byte[] a=Utf8.GetBytes(action);w.Write((byte)a.Length);w.Write(a);
                }
                return stream.ToArray();
            }
        }
        internal static bool ReadInput(byte[] bytes,int round,out OnlinePlayerInput input){
            input=null;if(bytes==null||bytes.Length<31||bytes.Length>2048)return false;
            try{
                using(var stream=new MemoryStream(bytes,false))using(var r=new BinaryReader(stream,Utf8)){
                    if(r.ReadByte()!=1||r.ReadInt32()!=round)return false;
                    var f=new OnlinePlayerInput{Sequence=r.ReadInt32(),Right=r.ReadSingle(),Forward=r.ReadSingle(),Lean=r.ReadSingle(),Yaw=r.ReadSingle(),Pitch=r.ReadSingle()};
                    if(f.Sequence<0||!Finite(f.Right,1.01f)||!Finite(f.Forward,1.01f)||!Finite(f.Lean,1.01f)||!Finite(f.Yaw,10)||!Finite(f.Pitch,2))return false;
                    int flags=r.ReadByte(),count=r.ReadByte();if(flags>3||count>24)return false;
                    f.Sprint=(flags&1)!=0;f.Crouch=(flags&2)!=0;
                    for(int i=0;i<count;i++){
                        int n=r.ReadByte();if(n<1||n>64||n>bytes.Length-stream.Position)return false;
                        f.Actions.Add(Utf8.GetString(r.ReadBytes(n)));
                    }
                    if(stream.Position!=stream.Length)return false;
                    input=f;return true;
                }
            }catch(EndOfStreamException){return false;}catch(DecoderFallbackException){return false;}
        }
        static bool Finite(float n,float bound){return !float.IsNaN(n)&&Math.Abs(n)<=bound;}
    }
}
