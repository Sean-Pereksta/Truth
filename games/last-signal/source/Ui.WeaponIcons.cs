using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;

namespace LastSignal {
    public sealed partial class Ui {
        static Bitmap WeaponIcon(string item) {
            if(item!="shield"&&item!="sword"&&item!="crossbow"&&item!="bolts")return null;
            const int size=96;
            var image=new Bitmap(size,size,PixelFormat.Format32bppPArgb);
            using(var g=Graphics.FromImage(image))
            using(var metal=new LinearGradientBrush(new Rectangle(14,8,68,76),Color.FromArgb(230,232,217),Color.FromArgb(77,98,100),32f))
            using(var wood=new LinearGradientBrush(new Rectangle(12,12,70,74),Color.FromArgb(183,132,78),Color.FromArgb(91,57,40),0f))
            using(var edge=new Pen(Color.FromArgb(60,49,42),2.3f))
            using(var brass=new Pen(Gold,3f))
            using(var stringLine=new Pen(Ivory,1.7f)) {
                g.SmoothingMode=SmoothingMode.AntiAlias;
                if(item=="shield"){
                    var face=new Rectangle(16,9,64,78);
                    g.FillEllipse(wood,face);
                    g.DrawLine(edge,33,16,33,80);g.DrawLine(edge,48,12,48,83);g.DrawLine(edge,63,17,63,80);
                    using(var rim=new Pen(Color.FromArgb(156,155,132),5f))g.DrawEllipse(rim,face);
                    g.DrawEllipse(edge,face);
                    g.FillEllipse(metal,36,36,24,25);g.DrawEllipse(edge,36,36,24,25);
                    foreach(var pin in new[]{new Point(45,12),new Point(19,44),new Point(72,44),new Point(45,76)})
                        g.FillEllipse(Brushes.Wheat,pin.X,pin.Y,5,5);
                }else{
                    g.TranslateTransform(48,48);g.RotateTransform(35);g.TranslateTransform(-48,-48);
                    if(item=="sword"){
                        var blade=new[]{new Point(48,3),new Point(55,19),new Point(52,61),new Point(43,61),new Point(42,19)};
                        g.FillPolygon(metal,blade);g.DrawPolygon(edge,blade);
                        g.DrawLine(stringLine,48,15,47,57);
                        g.FillRectangle(wood,44,63,8,20);g.DrawRectangle(edge,44,63,8,20);
                        g.DrawLine(brass,33,61,63,61);g.FillEllipse(metal,42,80,12,9);
                    }else if(item=="crossbow"){
                        var stock=new[]{new Point(44,17),new Point(51,17),new Point(52,64),new Point(56,81),new Point(48,88),new Point(40,78),new Point(45,62)};
                        g.FillPolygon(wood,stock);g.DrawPolygon(edge,stock);
                        using(var limb=new Pen(Color.FromArgb(178,168,134),6f)){
                            limb.StartCap=LineCap.Round;limb.EndCap=LineCap.Round;
                            g.DrawBezier(limb,11,43,22,16,71,16,84,43);
                        }
                        g.DrawLines(stringLine,new[]{new Point(11,43),new Point(48,59),new Point(84,43)});
                        g.DrawLine(brass,47,22,47,56);
                        g.FillPolygon(metal,new[]{new Point(47,11),new Point(51,24),new Point(43,24)});
                    }else{
                        for(int i=0;i<3;i++){
                            int x=33+i*13,y=14+(i%2)*9;
                            g.DrawLine(brass,x,y+9,x,y+63);
                            g.FillPolygon(metal,new[]{new Point(x,y-6),new Point(x+5,y+12),new Point(x-5,y+12)});
                            g.FillPolygon(Brushes.Wheat,new[]{new Point(x,y+47),new Point(x+5,y+55),new Point(x+5,y+65),new Point(x,y+59)});
                        }
                    }
                }
            }
            return image;
        }
    }
}
