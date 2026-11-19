using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;

namespace LastSignal
{
    // A loopback origin for cloudflared. The native host needs neither an administrator URL reservation nor an installed web server.
    public sealed class OnlineListener : IDisposable
    {
        const int ConnectionLimit = 48;
        readonly object gate = new object();
        readonly OnlineInbox events = new OnlineInbox();
        readonly Dictionary<int,PeerConnection> connections = new Dictionary<int,PeerConnection>();
        TcpListener listener;
        int nextPeer;
        bool disposed;
        public string InstanceId { get; private set; }

        public OnlineListener() { InstanceId = Guid.NewGuid().ToString("N"); }

        public int Start(int port = 0)
        {
            lock (gate)
            {
                if (disposed) throw new ObjectDisposedException("OnlineListener");
                if (listener != null) throw new InvalidOperationException("The host is already listening.");
                var bound = new TcpListener(IPAddress.Loopback, port);
                bound.ExclusiveAddressUse = true;
                try { bound.Start(32); } catch { bound.Stop(); throw; }
                listener = bound;
                OnlineTransport.Background("Last Signal host accept", delegate { AcceptLoop(bound); });
                return ((IPEndPoint)bound.LocalEndpoint).Port;
            }
        }

        void AcceptLoop(TcpListener bound)
        {
            try
            {
                while (true)
                {
                    TcpClient client = bound.AcceptTcpClient();
                    client.NoDelay = true;
                    AcceptStream(client.GetStream());
                }
            }
            catch (SocketException) {}
            catch (ObjectDisposedException) {}
        }

        internal void AcceptStream(Stream duplex)
        {
            PeerConnection peer;
            lock (gate)
            {
                if (disposed || connections.Count >= ConnectionLimit || events.Busy) { duplex.Close(); return; }
                peer = new PeerConnection(this, ++nextPeer, duplex);
                connections.Add(peer.Id, peer);
            }
            OnlineTransport.Background("Last Signal host receive", peer.Run);
        }

        public bool TryRead(out OnlinePeerPacket packet) { return events.Read(out packet); }
        PeerConnection Find(int id) { lock (gate) { PeerConnection c; return connections.TryGetValue(id, out c) ? c : null; } }
        internal int MobileEncoding(int peer) { var c = Find(peer); return c == null ? 0 : c.MobileEncoding; }
        public bool SendText(int peer, string text) { var c = Find(peer); return c != null && c.Send(1, OnlineTransport.TextBytes(text)); }
        public bool SendBinary(int peer, byte[] data) { var c = Find(peer); return c != null && c.Send(2, data); }
        public bool SendLatestBinary(int peer, byte[] data) { var c = Find(peer); return c != null && c.Send(2, data, true); }
        public void Disconnect(int peer) { var c = Find(peer); if (c != null) c.Close(); }
        void Remove(int id) { lock (gate) connections.Remove(id); }

        public void Dispose()
        {
            PeerConnection[] peers;
            lock (gate)
            {
                if (disposed) return;
                disposed = true;
                if (listener != null) listener.Stop();
                peers = new List<PeerConnection>(connections.Values).ToArray();
            }
            foreach (var peer in peers) peer.Stop("Host closed the room.");
        }

        sealed class WireReader
        {
            readonly Stream stream;
            readonly byte[] buffered = new byte[8192];
            int next, end;
            internal WireReader(Stream stream) { this.stream = stream; }

            internal byte Byte()
            {
                if (next == end)
                {
                    next = 0;
                    end = stream.Read(buffered, 0, buffered.Length);
                    if (end == 0) throw new EndOfStreamException("Participant disconnected.");
                }
                return buffered[next++];
            }

            internal byte[] Take(int count)
            {
                byte[] bytes = new byte[count];
                int used = Math.Min(count, end - next);
                if (used > 0) { Buffer.BlockCopy(buffered, next, bytes, 0, used); next += used; }
                while (used < count)
                {
                    int n = stream.Read(bytes, used, count - used);
                    if (n == 0) throw new EndOfStreamException("Participant disconnected.");
                    used += n;
                }
                return bytes;
            }

            internal string[] Request()
            {
                byte[] header = new byte[16384];
                var deadline = System.Diagnostics.Stopwatch.StartNew();
                for (int i = 0; i < header.Length; i++)
                {
                    if (deadline.ElapsedMilliseconds > 7000) throw new IOException("Handshake timed out.");
                    header[i] = Byte();
                    if (i >= 3 && header[i] == 10 && header[i-1] == 13 && header[i-2] == 10 && header[i-3] == 13)
                        return Encoding.ASCII.GetString(header, 0, i - 3).Split(new[]{"\r\n"}, StringSplitOptions.None);
                }
                throw new IOException("Invalid HTTP request.");
            }
        }

        sealed class PeerConnection
        {
            readonly OnlineListener owner;
            readonly Stream stream;
            readonly object life = new object();
            readonly object output = new object();
            readonly OnlineWrites writes = new OnlineWrites();
            internal readonly int Id;
            internal volatile int MobileEncoding;
            volatile bool ready;
            bool opened, stopped, closing, sentClose;

            internal PeerConnection(OnlineListener owner, int id, Stream stream) { this.owner = owner; Id = id; this.stream = stream; }
            internal bool Send(int opcode, byte[] data, bool supersedes = false) { return ready && writes.Add(opcode, data, supersedes); }
            internal void Close()
            {
                lock (life)
                {
                    if (stopped || closing) return;
                    closing = true;
                    if (ready) { ready = false; writes.Finish(true); return; }
                }
                Stop("Disconnected.");
            }
            internal void Stop(string reason)
            {
                lock (life)
                {
                    if (stopped) return;
                    stopped = true;
                    ready = false;
                    writes.Finish(false);
                    if (opened) owner.events.Put(Id, OnlinePacketKind.Closed, reason, null, 0);
                }
                owner.Remove(Id);
                try { stream.Close(); } catch (IOException) {}
            }

            static void WriteAscii(Stream stream, string text)
            {
                byte[] bytes = Encoding.ASCII.GetBytes(text);
                stream.Write(bytes, 0, bytes.Length);
            }
            static bool Http(Stream stream, string status, string body)
            {
                WriteAscii(stream, "HTTP/1.1 " + status + "\r\nContent-Type: text/plain; charset=utf-8\r\nCache-Control: no-store\r\nConnection: close\r\nContent-Length: " + Encoding.UTF8.GetByteCount(body) + "\r\n\r\n" + body);
                return false;
            }
            static string Value(Dictionary<string,string> fields, string name)
            {
                string result;
                return fields.TryGetValue(name, out result) ? result : "";
            }
            static bool HasToken(string header, string needed)
            {
                foreach (string token in header.Split(',')) if (String.Equals(token.Trim(), needed, StringComparison.OrdinalIgnoreCase)) return true;
                return false;
            }
            bool Upgrade(WireReader reader, Stream stream)
            {
                string[] lines = reader.Request();
                string[] request = lines[0].Split(' ');
                if (request.Length != 3 || request[0] != "GET" || request[2] != "HTTP/1.1")
                    return Http(stream,"400 Bad Request","Expected an HTTP GET.");
                var fields = new Dictionary<string,string>(StringComparer.OrdinalIgnoreCase);
                for (int i = 1; i < lines.Length; i++)
                {
                    int colon = lines[i].IndexOf(':');
                    if (colon < 1) return Http(stream,"400 Bad Request","Invalid HTTP header.");
                    string key = lines[i].Substring(0,colon).Trim(), value = lines[i].Substring(colon+1).Trim();
                    if (fields.ContainsKey(key)) fields[key] += "," + value; else fields.Add(key,value);
                }
                string[] target=request[1].Split(new[]{'?'},2);
                string path=target[0],host=Value(fields,"Host");
                if(path=="/health"||path=="/api/health")
                    return Http(stream,"200 OK","LastSignal-1:" + owner.InstanceId);
                if(path==MobileWeb.ConnectPath)
                {
                    if(!MobileWeb.SameOrigin(host,Value(fields,"Origin")))
                        return Http(stream,"403 Forbidden","Use the mobile client on this room's address.");
                    MobileEncoding=target.Length==2&&target[1]=="gzip=1" ? 2 : 1;
                }
                else if(path=="/ws"||path=="/last-signal/v1")
                {
                    if(fields.ContainsKey("Origin"))return Http(stream,"403 Forbidden","Open this room in the native game.");
                }
                else
                {
                    if(MobileWeb.Serve(stream,path,host))return false;
                    if(path=="/")return Http(stream,"200 OK","Last Signal host is online. Open Multiplayer in Last Signal and join with the host's tunnel address.");
                    return Http(stream,"404 Not Found","Unknown Last Signal route.");
                }
                if (!HasToken(Value(fields,"Connection"),"Upgrade") || !HasToken(Value(fields,"Upgrade"),"websocket") || Value(fields,"Sec-WebSocket-Version") != "13")
                    return Http(stream,"400 Bad Request","Expected a WebSocket connection.");
                string clientKey = Value(fields,"Sec-WebSocket-Key");
                try { if (Convert.FromBase64String(clientKey).Length != 16) return Http(stream,"400 Bad Request","Invalid WebSocket key."); }
                catch (FormatException) { return Http(stream,"400 Bad Request","Invalid WebSocket key."); }
                using (var sha = SHA1.Create())
                {
                    string accept = Convert.ToBase64String(sha.ComputeHash(Encoding.ASCII.GetBytes(clientKey+"258EAFA5-E914-47DA-95CA-C5AB0DC85B11")));
                    WriteAscii(stream, "HTTP/1.1 101 Switching Protocols\r\nConnection: Upgrade\r\nUpgrade: websocket\r\nSec-WebSocket-Accept: " + accept + "\r\n\r\n");
                }
                return true;
            }

            internal void Run()
            {
                string reason = "Participant disconnected.";
                try
                {
                    if (stream.CanTimeout) { stream.ReadTimeout = 7000; stream.WriteTimeout = 8000; }
                    var reader = new WireReader(stream);
                    if (!Upgrade(reader, stream)) return;
                    if (stream.CanTimeout) stream.ReadTimeout = 75000;
                    lock (life)
                    {
                        if (stopped) return;
                        ready = true;
                        if (!owner.events.Put(Id, OnlinePacketKind.Open, "", null, 0)) return;
                        opened = true;
                    }
                    OnlineTransport.Background("Last Signal host send", SendLoop);
                    ReadFrames(reader);
                }
                catch (Exception e) { reason = e.GetBaseException().Message; }
                finally { Stop(reason); }
            }

            void ReadFrames(WireReader reader)
            {
                using (var body = new MemoryStream())
                {
                    int messageKind = 0;
                    while (true)
                    {
                        byte first = reader.Byte(), second = reader.Byte();
                        bool final = (first & 128) != 0;
                        int opcode = first & 15;
                        if ((first & 112) != 0 || (second & 128) == 0) throw new IOException("Invalid WebSocket frame.");
                        ulong size = (uint)(second & 127);
                        if (size == 126) size = (uint)((reader.Byte() << 8) | reader.Byte());
                        else if (size == 127)
                        {
                            size = 0;
                            for (int i = 0; i < 8; i++) size = (size << 8) | reader.Byte();
                        }
                        bool control = opcode >= 8;
                        if (control && (!final || size > 125)) throw new IOException("Invalid WebSocket control frame.");
                        if (size > OnlineTransport.MaxMessageBytes || (!control && body.Length + (long)size > OnlineTransport.MaxMessageBytes))
                            throw new IOException("A network update was too large.");
                        byte[] mask = reader.Take(4), bytes = reader.Take((int)size);
                        for (int i = 0; i < bytes.Length; i++) bytes[i] ^= mask[i & 3];
                        if (control)
                        {
                            if (opcode == 8)
                            {
                                if (bytes.Length == 1) throw new IOException("Invalid disconnect message.");
                                if (bytes.Length > 2) OnlineTransport.Utf8.GetString(bytes,2,bytes.Length-2);
                                WriteFrame(8,bytes);
                                return;
                            }
                            if (opcode == 9) { if (!writes.Add(10, bytes)) throw new IOException("Connection backpressure."); }
                            else if (opcode != 10) throw new IOException("Unknown WebSocket control frame.");
                            continue;
                        }
                        if (opcode == 1 || opcode == 2)
                        {
                            if (messageKind != 0) throw new IOException("Incomplete WebSocket message.");
                            messageKind = opcode;
                        }
                        else if (opcode != 0 || messageKind == 0) throw new IOException("Unexpected WebSocket continuation.");
                        body.Write(bytes,0,bytes.Length);
                        if (!final) continue;
                        byte[] message = body.ToArray();
                        body.SetLength(0);
                        bool text = messageKind == 1;
                        messageKind = 0;
                        if (!owner.events.Put(Id, text ? OnlinePacketKind.Text : OnlinePacketKind.Binary,
                            text ? OnlineTransport.Utf8.GetString(message) : null, text ? null : message, message.Length))
                            throw new IOException("The host could not keep up with this connection.");
                    }
                }
            }

            static void Frame(Stream destination, int opcode, byte[] body)
            {
                byte[] header = new byte[10];
                header[0] = (byte)(128 | opcode);
                int n = 2;
                if (body.Length < 126) header[1] = (byte)body.Length;
                else if (body.Length <= 65535)
                {
                    header[1] = 126; header[2] = (byte)(body.Length >> 8); header[3] = (byte)body.Length; n = 4;
                }
                else
                {
                    header[1] = 127;
                    for (int i = 0; i < 8; i++) header[9-i] = (byte)((long)body.Length >> (i*8));
                    n = 10;
                }
                destination.Write(header,0,n);
                if (body.Length > 0) destination.Write(body,0,body.Length);
            }
            void WriteFrame(int opcode, byte[] bytes)
            {
                lock (output)
                {
                    if (sentClose) return;
                    Frame(stream,opcode,bytes);
                    if (opcode == 8) sentClose = true;
                }
            }
            void SendLoop()
            {
                try
                {
                    while (true)
                    {
                        bool ended;
                        OnlineWrite next = writes.Next(18000, out ended);
                        if (ended) { WriteFrame(8,new byte[]{3,232}); return; }
                        if (next == null) WriteFrame(9,new byte[0]);
                        else WriteFrame(next.Opcode,next.Bytes);
                    }
                }
                catch (Exception e) { Stop(e.GetBaseException().Message); }
                finally { Stop("Disconnected."); }
            }
        }
    }
}
