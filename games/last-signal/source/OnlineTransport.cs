using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Net.WebSockets;
using System.Text;
using System.Threading;

namespace LastSignal
{
    public enum OnlinePacketKind { Open, Text, Binary, Closed }

    public class OnlinePacket
    {
        public OnlinePacketKind Kind;
        public string Text;
        public byte[] Data;
    }

    public sealed class OnlinePeerPacket : OnlinePacket
    {
        public int Peer;
        internal int Bytes;
    }

    // One game-thread consumer. Network threads only enqueue fully reassembled messages.
    internal sealed class OnlineInbox
    {
        readonly Queue<OnlinePeerPacket> packets = new Queue<OnlinePeerPacket>();
        readonly Dictionary<int,int> peerMessages = new Dictionary<int,int>();
        int pendingBytes;

        internal bool Busy { get { lock (packets) return packets.Count >= 340; } }

        internal bool Put(int peer, OnlinePacketKind kind, string text, byte[] data, int bytes)
        {
            lock (packets)
            {
                if (kind != OnlinePacketKind.Closed &&
                    (packets.Count >= 384 || pendingBytes + bytes > 4 * OnlineTransport.MaxMessageBytes))
                    return false;
                if (peer != 0 && (kind == OnlinePacketKind.Text || kind == OnlinePacketKind.Binary))
                {
                    int count;
                    peerMessages.TryGetValue(peer,out count);
                    if (count >= 64) return false;
                    peerMessages[peer] = count + 1;
                }
                packets.Enqueue(new OnlinePeerPacket { Peer = peer, Kind = kind, Text = text, Data = data, Bytes = bytes });
                pendingBytes += bytes;
                return true;
            }
        }

        internal bool Read(out OnlinePeerPacket packet)
        {
            lock (packets)
            {
                packet = packets.Count > 0 ? packets.Dequeue() : null;
                if (packet == null) return false;
                pendingBytes -= packet.Bytes;
                int count;
                if ((packet.Kind == OnlinePacketKind.Text || packet.Kind == OnlinePacketKind.Binary) && peerMessages.TryGetValue(packet.Peer,out count))
                {
                    if (count == 1) peerMessages.Remove(packet.Peer); else peerMessages[packet.Peer] = count - 1;
                }
                return true;
            }
        }
    }

    internal sealed class OnlineWrite
    {
        internal int Opcode;
        internal byte[] Bytes;
    }

    internal sealed class OnlineWrites
    {
        readonly Queue<OnlineWrite> messages = new Queue<OnlineWrite>();
        OnlineWrite pendingState;
        bool closed;
        int bytes;

        internal bool Add(int opcode, byte[] buffer, bool supersedes = false)
        {
            if (buffer == null || buffer.Length > OnlineTransport.MaxMessageBytes) return false;
            lock (messages)
            {
                if (closed) return false;
                if (supersedes && pendingState != null)
                {
                    int total = bytes - pendingState.Bytes.Length + buffer.Length;
                    if (total > 2 * OnlineTransport.MaxMessageBytes) return false;
                    pendingState.Bytes = (byte[])buffer.Clone();
                    bytes = total;
                    return true;
                }
                if (messages.Count >= 96 || bytes + buffer.Length > 2 * OnlineTransport.MaxMessageBytes) return false;
                var write = new OnlineWrite { Opcode = opcode, Bytes = (byte[])buffer.Clone() };
                messages.Enqueue(write);
                // Text/control writes form a barrier between world snapshots from different round states.
                pendingState = supersedes ? write : null;
                bytes += buffer.Length;
                Monitor.Pulse(messages);
                return true;
            }
        }

        internal OnlineWrite Next(int waitMs, out bool ended)
        {
            lock (messages)
            {
                if (messages.Count == 0 && !closed) Monitor.Wait(messages, waitMs);
                ended = messages.Count == 0 && closed;
                if (messages.Count == 0) return null;
                OnlineWrite next = messages.Dequeue();
                if (Object.ReferenceEquals(next, pendingState)) pendingState = null;
                bytes -= next.Bytes.Length;
                return next;
            }
        }

        internal void Finish(bool drain)
        {
            lock (messages)
            {
                closed = true;
                if (!drain) { messages.Clear(); pendingState = null; bytes = 0; }
                Monitor.PulseAll(messages);
            }
        }
    }

    public sealed class OnlineTransport : IDisposable
    {
        public const int MaxMessageBytes = 1048576;
        internal static readonly UTF8Encoding Utf8 = new UTF8Encoding(false, true);
        readonly object sync = new object();
        ClientConnection current;
        bool disposed;

        public static string NormalizeEndpoint(string value)
        {
            string input = (value ?? "").Trim();
            if (input.Length == 0 || input.Length > 2048) throw new ArgumentException("Enter the host address.");
            bool bare = input.IndexOf("://", StringComparison.Ordinal) < 0;
            Uri uri;
            if (!Uri.TryCreate(bare ? "https://" + input : input, UriKind.Absolute, out uri) ||
                String.IsNullOrEmpty(uri.Host) || uri.UserInfo.Length != 0 || uri.Fragment.Length != 0)
                throw new ArgumentException("Enter a valid host address.");
            bool secure = uri.Scheme == "https" || uri.Scheme == "wss";
            if (!secure && uri.Scheme != "http" && uri.Scheme != "ws")
                throw new ArgumentException("Use an HTTPS or WebSocket host address.");
            if (bare && uri.IsLoopback) { secure = false; uri = new Uri("http://" + input); }
            var builder = new UriBuilder(uri) { Scheme = secure ? "wss" : "ws", Port = uri.IsDefaultPort ? -1 : uri.Port };
            return builder.Uri.AbsoluteUri;
        }

        internal static void Background(string name, ThreadStart method)
        {
            new Thread(method) { IsBackground = true, Name = name }.Start();
        }

        internal static byte[] TextBytes(string text)
        {
            if (text == null || text.Length > MaxMessageBytes) return null;
            try { return Utf8.GetByteCount(text) <= MaxMessageBytes ? Utf8.GetBytes(text) : null; }
            catch (EncoderFallbackException) { return null; }
        }

        public void Connect(string endpoint)
        {
            Connect(endpoint,null);
        }
        internal void Connect(string endpoint,CookieContainer access)
        {
            lock (sync)
            {
                if (disposed) throw new ObjectDisposedException("OnlineTransport");
                if (current != null) current.Close();
                current = new ClientConnection();
                try { current.Connect(new Uri(NormalizeEndpoint(endpoint)),access); }
                catch (ArgumentException e) { current.Stop(e.Message); }
            }
        }

        internal void Attach(WebSocket upgraded)
        {
            if (upgraded == null || upgraded.State != WebSocketState.Open) throw new ArgumentException("An open WebSocket is required.");
            lock (sync)
            {
                if (disposed) throw new ObjectDisposedException("OnlineTransport");
                if (current != null) current.Close();
                current = new ClientConnection();
                current.Attach(upgraded);
            }
        }

        public bool SendText(string text) { lock (sync) { return current != null && current.Send(1, TextBytes(text)); } }
        public bool SendBinary(byte[] data) { lock (sync) { return current != null && current.Send(2, data); } }
        public bool TryRead(out OnlinePacket packet)
        {
            lock (sync)
            {
                OnlinePeerPacket next = null;
                bool got = current != null && current.Inbox.Read(out next);
                packet = next;
                return got;
            }
        }
        public void Close() { lock (sync) { if (current != null) current.Close(); } }
        public void Dispose()
        {
            lock (sync)
            {
                disposed = true;
                if (current != null) current.Close();
            }
        }

        sealed class ClientConnection
        {
            readonly object life = new object();
            readonly OnlineWrites writes = new OnlineWrites();
            internal readonly OnlineInbox Inbox = new OnlineInbox();
            WebSocket socket;
            volatile bool ready;
            bool stopped, closing;

            internal void Connect(Uri endpoint,CookieContainer access) { Background("Last Signal connect", delegate { Receive(endpoint,access); }); }
            internal void Attach(WebSocket upgraded)
            {
                Background("Last Signal receive", delegate
                {
                    try { using (upgraded) Pump(upgraded); }
                    catch (Exception e) { Stop(e.GetBaseException().Message); }
                    finally { Stop("The host disconnected."); }
                });
            }
            internal bool Send(int opcode, byte[] data) { return ready && writes.Add(opcode, data); }

            void Receive(Uri uri,CookieContainer access)
            {
                string reason = "The host disconnected.";
                try
                {
                    using (var connection = new ClientWebSocket())
                    {
                        lock (life)
                        {
                            if (stopped) return;
                            socket = connection;
                        }
                        connection.Options.KeepAliveInterval = TimeSpan.FromSeconds(18);
                        if(access!=null)connection.Options.Cookies=access;
                        // Framework applications compiled with the built-in compiler can inherit legacy TLS defaults.
                        if (uri.Scheme == "wss" && (int)ServicePointManager.SecurityProtocol != 0)
                            ServicePointManager.SecurityProtocol |= SecurityProtocolType.Tls12;
                        using (var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(14)))
                            connection.ConnectAsync(uri, timeout.Token).GetAwaiter().GetResult();
                        Pump(connection);
                    }
                }
                catch (OperationCanceledException) { reason = "Connection timed out."; }
                catch (Exception e) { reason = e.GetBaseException().Message; }
                finally { Stop(reason); }
            }

            void Pump(WebSocket connection)
            {
                lock (life)
                {
                    if (stopped) return;
                    socket = connection;
                    ready = true;
                    Inbox.Put(0, OnlinePacketKind.Open, "", null, 0);
                }
                Background("Last Signal client send", delegate { SendLoop(connection); });
                var buffer = new byte[32768];
                using (var assembled = new MemoryStream())
                {
                    while (true)
                    {
                        WebSocketReceiveResult received = connection.ReceiveAsync(new ArraySegment<byte>(buffer), CancellationToken.None).GetAwaiter().GetResult();
                        if (received.MessageType == WebSocketMessageType.Close)
                        {
                            Stop(String.IsNullOrEmpty(received.CloseStatusDescription) ? "The host disconnected." : received.CloseStatusDescription);
                            return;
                        }
                        if (assembled.Length + received.Count > MaxMessageBytes) throw new IOException("A network update was too large.");
                        assembled.Write(buffer, 0, received.Count);
                        if (!received.EndOfMessage) continue;
                        byte[] bytes = assembled.ToArray();
                        assembled.SetLength(0);
                        bool isText = received.MessageType == WebSocketMessageType.Text;
                        if (!Inbox.Put(0, isText ? OnlinePacketKind.Text : OnlinePacketKind.Binary,
                            isText ? Utf8.GetString(bytes) : null, isText ? null : bytes, bytes.Length))
                            throw new IOException("The connection could not keep up with the match.");
                    }
                }
            }

            void SendLoop(WebSocket connection)
            {
                try
                {
                    while (true)
                    {
                        bool ended;
                        OnlineWrite write = writes.Next(18000, out ended);
                        if (ended)
                        {
                            if (connection.State == WebSocketState.Open)
                                using (var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(2)))
                                    connection.CloseOutputAsync(WebSocketCloseStatus.NormalClosure, "Left the room", timeout.Token).GetAwaiter().GetResult();
                            break;
                        }
                        if (write == null) continue;
                        var kind = write.Opcode == 1 ? WebSocketMessageType.Text : WebSocketMessageType.Binary;
                        using (var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(8)))
                            connection.SendAsync(new ArraySegment<byte>(write.Bytes), kind, true, timeout.Token).GetAwaiter().GetResult();
                    }
                }
                catch (Exception e) { Stop(e.GetBaseException().Message); }
                finally { Stop("Disconnected."); }
            }

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
                WebSocket closingSocket;
                lock (life)
                {
                    if (stopped) return;
                    stopped = true;
                    ready = false;
                    writes.Finish(false);
                    closingSocket = socket;
                    Inbox.Put(0, OnlinePacketKind.Closed, reason, null, 0);
                }
                if (closingSocket != null) try { closingSocket.Abort(); } catch (ObjectDisposedException) {}
            }
        }
    }
}
