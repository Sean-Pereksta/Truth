using System;
using System.IO;
using System.Net;
using System.Threading;
using System.Threading.Tasks;

namespace LastSignal {
    public sealed partial class Ui {
        readonly ManagedDirectory managedDirectory=new ManagedDirectory();
        readonly OnlineRoom[] paintedServers=new OnlineRoom[RoomPageSize];
        OnlineRoom[] managedServers=new OnlineRoom[0];
        CancellationTokenSource managedRequest;
        Task<OnlineRoom[]> pendingList;
        Task<ManagedAdmission> pendingAdmission;
        string managedMessage="";

        void CancelManagedRequest(){
            if(managedRequest!=null){managedRequest.Cancel();managedRequest.Dispose();managedRequest=null;}
            pendingList=null;pendingAdmission=null;
        }
        void ManagedWork(Game g,string action,OnlineRoom selected=null,string code=null){
            CancelManagedRequest();
            var cancel=new CancellationTokenSource();managedRequest=cancel;
            var token=cancel.Token;
            g.Panel="onlineManaged";roomPage=0;onlineNote="";
            if(action=="browse"){
                managedMessage="Finding public servers.";
                pendingList=Task.Run(()=>managedDirectory.List(token),token);
            }else {
                managedMessage=action=="live"?"Finding an arena with an open seat.":"Checking the server.";
                pendingAdmission=Task.Run(()=>action=="live"?managedDirectory.Live(token):managedDirectory.Join(selected,code,token),token);
            }
        }
        bool ManagedResults(Game g){
            if(pendingList!=null&&pendingList.IsCompleted){
                try {managedServers=pendingList.GetAwaiter().GetResult();managedMessage=managedServers.Length==0?"No public arenas are listed.":"Choose a server.";}
                catch(Exception error){managedServers=new OnlineRoom[0];managedMessage=ManagedError(error);}
                finally{pendingList=null;}
            }
            if(pendingAdmission!=null&&pendingAdmission.IsCompleted){
                try{
                    var admission=pendingAdmission.GetAwaiter().GetResult();
                    g.Online.Join(admission.Invite,OnlinePlayerName(g),admission.Access);
                    return true;
                }catch(Exception error){managedMessage=ManagedError(error);}
                finally{pendingAdmission=null;}
            }
            return false;
        }
        static string ManagedError(Exception error){
            if(error is IOException)return error.Message;
            var web=error as WebException;
            if(web!=null){
                using(var response=web.Response as HttpWebResponse){
                    if(response!=null&&response.StatusCode==HttpStatusCode.NotFound)return "No server has that code.";
                    if(response!=null&&response.StatusCode==HttpStatusCode.Conflict)return "The match just filled or started.";
                    if(response!=null&&response.StatusCode==HttpStatusCode.Forbidden)return "The server did not accept the code.";
                }
            }
            return "Could not reach a server. Refresh the list or try again.";
        }
    }
}
