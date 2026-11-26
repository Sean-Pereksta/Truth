using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;

namespace LastSignal {
    internal static class MobileWeb {
        internal const string ConnectPath = "/mobile/ws";
        static readonly string root=AppDomain.CurrentDomain.BaseDirectory;
        static readonly Regex TunnelHost=new Regex(@"\A[a-z0-9-]+\.trycloudflare\.com\z",RegexOptions.IgnoreCase|RegexOptions.CultureInvariant);
        static readonly Dictionary<string,string> MobileFiles=new Dictionary<string,string> {
            {"index.html","text/html; charset=utf-8"},{"app.js","text/javascript; charset=utf-8"},
            {"render.js","text/javascript; charset=utf-8"},{"style.css","text/css; charset=utf-8"}
        };
        static readonly Dictionary<string,string> Assets=new Dictionary<string,string> {
            {"models.bin","application/octet-stream"},{"modelpaint.png","image/png"},{"paint.png","image/png"},
            {"landmarks.bin.gz","application/octet-stream"},{"survivors.bin.gz","application/octet-stream"},
            {"field.bin.gz","application/octet-stream"},{"equipment.bin.gz","application/octet-stream"},
            {"ground.png","image/png"},{"soil.png","image/png"},{"pavers.png","image/png"},{"sky.png","image/png"},
            {"gorge_floor.png","image/png"},{"gorge_path.png","image/png"},
            {"frost_floor.png","image/png"},{"frost_path.png","image/png"},{"Audio/wood.wav","audio/wav"}
        };
        internal static bool Available { get { return File.Exists(Path.Combine(root,"Mobile","index.html")); } }

        static string Origin(string host) {
            if(TunnelHost.IsMatch(host))return "https://"+host;
            Uri uri;
            if(!Uri.TryCreate("http://"+host,UriKind.Absolute,out uri)||
                !String.Equals(uri.Authority,host,StringComparison.OrdinalIgnoreCase))return "";
            return uri.Host=="127.0.0.1"||uri.Host=="localhost" ? "http://"+host : "";
        }

        internal static bool SameOrigin(string host,string browserOrigin) {
            string expected=Origin(host);
            return expected.Length>0&&String.Equals(expected,browserOrigin,StringComparison.OrdinalIgnoreCase);
        }

        // These names are the complete public file list. User-supplied paths never reach the filesystem.
        internal static bool Serve(Stream destination,string path,string host) {
            if(path=="/"&&!Available)return false;
            if(path=="/"||path=="/mobile"){
                Write(destination,"HTTP/1.1 302 Found\r\nLocation: /mobile/\r\nContent-Length: 0\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n");
                return true;
            }
            if(!path.StartsWith("/mobile/",StringComparison.Ordinal))return false;
            bool asset=path.StartsWith("/mobile/assets/",StringComparison.Ordinal);
            string name=asset?path.Substring(15):path.Substring(8),type;
            if(name.Length==0&&!asset)name="index.html";
            if(!(asset?Assets:MobileFiles).TryGetValue(name,out type))return false;
            string file=Path.Combine(root,asset?"BrowserAssets":"Mobile",name);
            if(asset&&!File.Exists(file))file=Path.Combine(root,"Assets",name);
            if(!File.Exists(file))return false;
            string contentEncoding=asset&&name.EndsWith(".bin.gz",StringComparison.Ordinal)?"Content-Encoding: gzip\r\n":"";
            string origin=Origin(host);
            string socket=origin.Length>0?" "+(origin.StartsWith("https:",StringComparison.Ordinal)?"wss"+origin.Substring(5):"ws"+origin.Substring(4)):"";
            try {
                using(var input=new FileStream(file,FileMode.Open,FileAccess.Read,FileShare.Read)) {
                    Write(destination,"HTTP/1.1 200 OK\r\nContent-Type: "+type+"\r\n"+contentEncoding+"Content-Length: "+
                        input.Length.ToString(CultureInfo.InvariantCulture)+"\r\nConnection: close\r\nCache-Control: "+
                        (asset?"public, max-age=3600":"no-store")+"\r\nX-Content-Type-Options: nosniff\r\n"+
                        "Referrer-Policy: no-referrer\r\nContent-Security-Policy: default-src 'none'; "+
                        "script-src 'self'; style-src 'self'; img-src 'self' blob:; connect-src 'self'"+socket+"; "+
                        "base-uri 'none'; frame-ancestors 'none'; form-action 'none'\r\n\r\n");
                    input.CopyTo(destination);
                }
                return true;
            } catch(FileNotFoundException) { return false; }
        }

        static void Write(Stream stream,string text) {
            byte[] bytes=Encoding.ASCII.GetBytes(text);
            stream.Write(bytes,0,bytes.Length);
        }
    }
}
