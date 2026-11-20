using System;

namespace LastSignal {
    public sealed partial class Ui {
        const int RoomPageSize=6;
        int roomPage;
        readonly string[] paintedInvites=new string[RoomPageSize];
        void OnlineBrowse(Game g) {
            Backdrop(true);
            float x=sw*.105f,y=sh*.10f,w=Math.Min(sw-x*2,970);
            bool managed=g.Panel=="onlineManaged";
            Header(managed?"Last Signal servers":"Public lobbies","Choose an open room to join its lobby.",x,y);
            var directory=g.Online==null?null:g.Online.Directory;
            var rooms=managed?Array.FindAll(managedServers,room=>room.Expires>DateTime.UtcNow):directory==null?null:directory.Rooms;
            int count=rooms==null?0:rooms.Length,pages=Math.Max(1,(count+RoomPageSize-1)/RoomPageSize);
            roomPage=Math.Max(0,Math.Min(roomPage,pages-1));
            float top=y+106;
            T(managed?"SERVER":"HOST",x+14,top,13,Muted,true,true);T(managed?"STATUS":"ARENA",x+w*.5f,top,13,Muted,true,true);
            Right("PLAYERS",x+w-17,top,13,Muted,true,true);
            Array.Clear(paintedInvites,0,paintedInvites.Length);Array.Clear(paintedServers,0,paintedServers.Length);
            for(int row=0;row<RoomPageSize;row++){
                int index=roomPage*RoomPageSize+row;if(index>=count)break;
                var room=rooms[index];if(room==null)continue;
                float by=top+25+row*47;string id="onlineRoom"+row;
                paintedServers[row]=managed?room:null;paintedInvites[row]=room.Invite;HitBox(id,x,by,w,43);
                bool hot=selected==id;Box(x,by,w,43,hot?Gold:A(Muted,20));
                T(Ellipsis(room.Name??"",w*.46f,17),x+14,by+10,17,hot?Ink:Ivory,true);
                string description=managed?(room.Phase=="waiting"?"In lobby":room.Phase=="finished"?"Finished":"In match"):room.Arena??"";
                T(Ellipsis(description,w*.29f,16),x+w*.5f,by+11,16,hot?Ink:Muted);
                Right(room.Humans+" / 8",x+w-17,by+11,16,hot?Ink:Ivory,true,true);
            }
            string status=managed?managedMessage:directory==null?"Room directory unavailable.":directory.BrowseStatus;
            if(count==0&&String.IsNullOrEmpty(status))status="No open public lobbies.";
            Para(status,x+14,count==0?top+65:top+311,w-28,48,16,Muted);
            float controls=top+378;
            Action("onlineRefresh","Refresh",x,controls,170,44);
            Action("back","Back",x+184,controls,150,44);
            if(managed)Action("onlineManagedPin","Join by code",x+348,controls,190,44);
            if(pages>1){
                if(roomPage>0)Action("onlinePrev","Previous",x+w-378,controls,145,44);
                Mid((roomPage+1)+" / "+pages,x+w-194,controls+14,13,Muted,true,true);
                if(roomPage<pages-1)Action("onlineNext","Next",x+w-141,controls,141,44);
            }
            PadHelp(g,"D-pad  Navigate      A  Select      Y  Refresh      B  Back");
        }
        bool RoomAction(Game g,string id) {
            if(id=="onlineList"){
                if(g.Online!=null&&g.Online.IsHost){onlineNote="";g.Online.ListPublic(!g.Online.IsListed);}return true;
            }
            if(id=="onlineFind"){
                roomPage=0;onlineNote="";g.Panel="onlineBrowse";
                if(g.Online!=null)g.Online.Directory.Refresh();return true;
            }
            bool managed=g.Panel=="onlineManaged";
            if(!managed&&g.Panel!="onlineBrowse")return false;
            if(id=="onlineRefresh"){if(managed)ManagedWork(g,"browse");else if(g.Online!=null)g.Online.Directory.Refresh();return true;}
            if(id=="onlinePrev"||id=="onlineNext"){roomPage+=id=="onlinePrev"?-1:1;selected="onlineRoom0";return true;}
            if(!id.StartsWith("onlineRoom",StringComparison.Ordinal))return false;
            int row;if(!Int32.TryParse(id.Substring(10),out row)||row<0||row>=RoomPageSize)return true;
            if(managed){if(paintedServers[row]!=null)ManagedWork(g,"join",paintedServers[row]);return true;}
            if(string.IsNullOrEmpty(paintedInvites[row]))return true;
            invite=paintedInvites[row];return ActivateOnline(g,"onlineConnect");
        }
    }
}
