using System;

namespace LastSignal {
    public sealed partial class Renderer {
        void DrawFletchingTrail(Shot arrow){
            float duration=Math.Min(.077f,arrow.Age);
            if(duration<.016f)return;
            // Only the recently travelled path is visible. An arrow dropping over
            // cover cannot draw a line through the obstruction back to its archer.
            glDisable(Texture);glDisable(Light);Alpha();glDepthMask(0);
            glBegin(3);
            for(int i=0;i<=6;i++){
                float f=i/6f,t=(1-f)*duration;
                glColor4f(.90f,.79f,.59f,.42f*f*f);
                glVertex3f(arrow.X-arrow.DX*t,arrow.Y-arrow.DY*t-.5f*arrow.Gravity*t*t,arrow.Z-arrow.DZ*t);
            }
            glEnd();glDepthMask(1);glDisable(Blend);glEnable(Light);Bind(paint);
        }
    }
}
