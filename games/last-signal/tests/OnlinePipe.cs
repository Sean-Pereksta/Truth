using System;
using System.Diagnostics;
using System.IO;
using System.IO.Pipes;
using System.Net.WebSockets;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using LastSignal;

// Test fixture: use a Windows duplex pipe wherever the execution sandbox forbids TCP loopback.
// HTTP upgrade, native WebSocket framing, bounded queues and room traffic use the shipped game assembly.
public static class OnlinePipe
{
    static string LocalName(string name) { return "LOCAL\\"+name; }
    static NamedPipeServerStream Server(string name)
    {
        return new NamedPipeServerStream(LocalName(name),PipeDirection.InOut,NamedPipeServerStream.MaxAllowedServerInstances,
            PipeTransmissionMode.Byte,PipeOptions.Asynchronous,65536,65536);
    }
    static NamedPipeClientStream Client(string name)
    {
        return new NamedPipeClientStream(".",LocalName(name),PipeDirection.InOut,PipeOptions.Asynchronous);
    }
    static void Accept(OnlineListener listener,Stream stream)
    {
        typeof(OnlineListener).GetMethod("AcceptStream",BindingFlags.NonPublic|BindingFlags.Instance).Invoke(listener,new object[]{stream});
    }
    sealed class PipeHost : IDisposable
    {
        readonly object gate=new object();
        readonly OnlineListener listener;
        readonly string name;
        NamedPipeServerStream next;
        bool closed;
        internal PipeHost(OnlineListener listener,string name)
        {
            this.listener=listener;this.name=name;
            Listen();
        }
        void Listen()
        {
            lock(gate)
            {
                if(closed)return;
                var stream=Server(name);
                next=stream;
                stream.BeginWaitForConnection(delegate(IAsyncResult ar)
                {
                    try
                    {
                        stream.EndWaitForConnection(ar);
                        lock(gate)
                        {
                            if(closed){stream.Dispose();return;}
                            next=null;
                            Accept(listener,stream);
                            Listen();
                        }
                    }
                    catch(ObjectDisposedException){}
                    catch(IOException){lock(gate){if(!closed)throw;}}
                },null);
            }
        }
        public void Dispose(){lock(gate){closed=true;if(next!=null)next.Dispose();}}
    }
    public static IDisposable Serve(OnlineListener listener,string pipeName)
    {
        return new PipeHost(listener,pipeName);
    }
    public static void Dial(OnlineTransport client,string pipeName)
    {
        var raw=Client(pipeName);
        try{raw.Connect(5000);Attach(client,Upgrade(raw));}
        catch{raw.Dispose();throw;}
    }
    public static Stream Open(OnlineListener listener)
    {
        string name = "LastSignal-test-" + Guid.NewGuid().ToString("N");
        var server = Server(name);
        var client = Client(name);
        try
        {
            IAsyncResult accepting = server.BeginWaitForConnection(null,null);
            client.Connect(3000);
            server.EndWaitForConnection(accepting);
            Accept(listener,server);
            return client;
        }
        catch { client.Dispose(); server.Dispose(); throw; }
    }
    public static WebSocket Upgrade(OnlineListener listener)
    {
        return Upgrade(Open(listener));
    }
    static WebSocket Upgrade(Stream stream)
    {
        try
        {
            byte[] nonce = new byte[16];
            using(var rng = RandomNumberGenerator.Create()) rng.GetBytes(nonce);
            string key = Convert.ToBase64String(nonce);
            byte[] upgrade = Encoding.ASCII.GetBytes("GET /ws HTTP/1.1\r\nHost: localhost\r\nConnection: Upgrade\r\nUpgrade: websocket\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: "+key+"\r\n\r\n");
            stream.Write(upgrade,0,upgrade.Length);
            string reply = "";
            var timer = Stopwatch.StartNew();
            using(var reader = new MemoryStream())
            {
                while(reader.Length < 4096 && timer.ElapsedMilliseconds < 5000)
                {
                    byte[] one = new byte[1];
                    IAsyncResult pending = stream.BeginRead(one,0,1,null,null);
                    try
                    {
                        if (!pending.AsyncWaitHandle.WaitOne(4000)) throw new IOException("HTTP upgrade timed out");
                        if (stream.EndRead(pending)!=1) throw new IOException("Lost HTTP handshake");
                    }
                    finally { pending.AsyncWaitHandle.Close(); }
                    reader.WriteByte(one[0]);
                    if(one[0]==10)
                    {
                        reply = Encoding.ASCII.GetString(reader.ToArray());
                        if(reply.EndsWith("\r\n\r\n",StringComparison.Ordinal))break;
                    }
                }
            }
            string accept;
            using(var sha=SHA1.Create())accept=Convert.ToBase64String(sha.ComputeHash(Encoding.ASCII.GetBytes(key+"258EAFA5-E914-47DA-95CA-C5AB0DC85B11")));
            if(!reply.StartsWith("HTTP/1.1 101 ",StringComparison.Ordinal)||reply.IndexOf("Sec-WebSocket-Accept: "+accept+"\r\n",StringComparison.OrdinalIgnoreCase)<0)
                throw new IOException("Invalid room upgrade "+reply);
            return WebSocket.CreateClientWebSocket(stream, null, 32768, 32768, TimeSpan.FromSeconds(18), false, WebSocket.CreateClientBuffer(32768,32768));
        }
        catch { stream.Close(); throw; }
    }
    public static void Dial(OnlineListener listener, OnlineTransport client)
    {
        Attach(client,Upgrade(listener));
    }
    static void Attach(OnlineTransport client,WebSocket socket)
    {
        try { typeof(OnlineTransport).GetMethod("Attach",BindingFlags.NonPublic | BindingFlags.Instance).Invoke(client,new object[]{socket}); }
        catch { socket.Dispose(); throw; }
    }
}
