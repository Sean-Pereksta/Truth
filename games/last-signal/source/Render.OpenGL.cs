using System;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Windows.Forms;

namespace LastSignal {
    public sealed partial class Renderer {
        const uint SearchDllDirectory = 0x100;
        const uint SearchSystem32 = 0x800;
        const string SoftwareDriverDigest = "B04DE4541863BC7D8879040A78889C4849C1B1DA2784C4630F734C146C2998CE";

        [DllImport("kernel32.dll", EntryPoint = "LoadLibraryExW", CharSet = CharSet.Unicode, ExactSpelling = true, SetLastError = true)]
        static extern IntPtr LoadLibraryEx(string filename, IntPtr reserved, uint flags);

        [DllImport("kernel32.dll", CharSet = CharSet.Ansi, ExactSpelling = true)]
        static extern IntPtr GetProcAddress(IntPtr library, string name);

        [DefaultDllImportSearchPaths(DllImportSearchPath.System32)]
        [DllImport("opengl32.dll", EntryPoint = "wglCreateContext")]
        static extern IntPtr ProbeCreate(IntPtr dc);

        [DefaultDllImportSearchPaths(DllImportSearchPath.System32)]
        [DllImport("opengl32.dll", EntryPoint = "wglMakeCurrent")]
        static extern bool ProbeCurrent(IntPtr dc, IntPtr context);

        [DefaultDllImportSearchPaths(DllImportSearchPath.System32)]
        [DllImport("opengl32.dll", EntryPoint = "wglDeleteContext")]
        static extern bool ProbeDelete(IntPtr context);

        delegate int ChooseSurface(IntPtr dc, ref PixelFormatDescriptor format);
        delegate bool SetSurface(IntPtr dc, int index, ref PixelFormatDescriptor format);
        delegate bool PresentSurface(IntPtr dc);

        static IntPtr glLibrary;
        static ChooseSurface chooseSurface;
        static SetSurface setSurface;
        static PresentSurface presentSurface;

        // A window's pixel format can be set only once. Probe on an independent
        // window so the software driver can set the main window's format if needed.
        static bool NativeGraphicsAvailable(PixelFormatDescriptor format) {
            var probeWindow = new NativeWindow();
            IntPtr probeDc = IntPtr.Zero;
            IntPtr context = IntPtr.Zero;
            try {
                probeWindow.CreateHandle(new CreateParams { ClassStyle = 0x20, Width = 8, Height = 8 });
                probeDc = GetDC(probeWindow.Handle);
                int index = ChoosePixelFormat(probeDc, ref format);
                if (index == 0 || !SetPixelFormat(probeDc, index, ref format)) return false;
                context = ProbeCreate(probeDc);
                return context != IntPtr.Zero && ProbeCurrent(probeDc, context);
            } catch (DllNotFoundException) {
                return false;
            } finally {
                if (context != IntPtr.Zero) {
                    ProbeCurrent(IntPtr.Zero, IntPtr.Zero);
                    ProbeDelete(context);
                }
                if (probeDc != IntPtr.Zero) ReleaseDC(probeWindow.Handle, probeDc);
                if (probeWindow.Handle != IntPtr.Zero) probeWindow.DestroyHandle();
            }
        }

        static Delegate GraphicsFunction(IntPtr library, Type type, string name) {
            IntPtr address = GetProcAddress(library, name);
            if (address == IntPtr.Zero) throw new InvalidDataException("Graphics runtime is missing " + name + ".");
            return Marshal.GetDelegateForFunctionPointer(address, type);
        }

        static string VerifiedSoftwareDriver() {
            string path = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Hosting", "Graphics", "opengl32sw.dll");
            if (!File.Exists(path)) {
                throw new InvalidOperationException("Windows could not start OpenGL. Update the graphics driver or install Last Signal from the Catnmice launcher with software rendering support.");
            }
            using (var file = File.OpenRead(path))
            using (var sha = SHA256.Create()) {
                string digest = BitConverter.ToString(sha.ComputeHash(file)).Replace("-", "");
                if (digest != SoftwareDriverDigest) throw new InvalidDataException("The Last Signal software graphics driver is damaged. Reinstall the game.");
            }
            return path;
        }

        static void LoadGraphics(PixelFormatDescriptor format) {
            if (glLibrary != IntPtr.Zero) return;
            bool useSoftware = Environment.GetEnvironmentVariable("LASTSIGNAL_SOFTWARE_GL") == "1" || !NativeGraphicsAvailable(format);
            string driver = useSoftware
                ? VerifiedSoftwareDriver()
                : Path.Combine(Environment.SystemDirectory, "opengl32.dll");
            uint searchPaths = useSoftware ? SearchDllDirectory | SearchSystem32 : SearchSystem32;
            IntPtr library = LoadLibraryEx(driver, IntPtr.Zero, searchPaths);
            if (library == IntPtr.Zero) throw new InvalidOperationException("Could not load the Windows graphics runtime.");

            // Both drivers expose the same OpenGL drawing functions.
            foreach (var field in typeof(Renderer).GetFields(BindingFlags.Static | BindingFlags.NonPublic)) {
                bool isGraphicsFunction = field.Name.StartsWith("gl", StringComparison.Ordinal) ||
                    field.Name.StartsWith("wgl", StringComparison.Ordinal);
                if (isGraphicsFunction && typeof(MulticastDelegate).IsAssignableFrom(field.FieldType)) {
                    field.SetValue(null, GraphicsFunction(library, field.FieldType, field.Name));
                }
            }
            if (useSoftware) {
                chooseSurface = (ChooseSurface)GraphicsFunction(library, typeof(ChooseSurface), "wglChoosePixelFormat");
                setSurface = (SetSurface)GraphicsFunction(library, typeof(SetSurface), "wglSetPixelFormat");
                presentSurface = (PresentSurface)GraphicsFunction(library, typeof(PresentSurface), "wglSwapBuffers");
            } else {
                chooseSurface = ChoosePixelFormat;
                setSurface = SetPixelFormat;
                presentSurface = SwapBuffers;
            }
            glLibrary = library;
        }

        delegate IntPtr wglCreateContextProc(IntPtr dc);
        static wglCreateContextProc wglCreateContext = null;
        delegate bool wglDeleteContextProc(IntPtr rc);
        static wglDeleteContextProc wglDeleteContext = null;
        delegate bool wglMakeCurrentProc(IntPtr dc,IntPtr rc);
        static wglMakeCurrentProc wglMakeCurrent = null;
        delegate void glLightfProc(uint light,uint param,float v);
        static glLightfProc glLightf = null;
        delegate void glViewportProc(int x,int y,int w,int h);
        static glViewportProc glViewport = null;
        delegate void glClearColorProc(float r,float g,float b,float a);
        static glClearColorProc glClearColor = null;
        delegate void glClearProc(uint mask);
        static glClearProc glClear = null;
        delegate void glEnableProc(uint cap);
        static glEnableProc glEnable = null;
        delegate void glDisableProc(uint cap);
        static glDisableProc glDisable = null;
        delegate void glMatrixModeProc(uint mode);
        static glMatrixModeProc glMatrixMode = null;
        delegate void glLoadIdentityProc();
        static glLoadIdentityProc glLoadIdentity = null;
        delegate void glPushMatrixProc();
        static glPushMatrixProc glPushMatrix = null;
        delegate void glPopMatrixProc();
        static glPopMatrixProc glPopMatrix = null;
        delegate void glTranslatefProc(float x,float y,float z);
        static glTranslatefProc glTranslatef = null;
        delegate void glRotatefProc(float angle,float x,float y,float z);
        static glRotatefProc glRotatef = null;
        delegate void glScalefProc(float x,float y,float z);
        static glScalefProc glScalef = null;
        delegate void glFrustumProc(double left,double right,double bottom,double top,double near,double far);
        static glFrustumProc glFrustum = null;
        delegate void glOrthoProc(double left,double right,double bottom,double top,double near,double far);
        static glOrthoProc glOrtho = null;
        delegate void glBeginProc(uint type);
        static glBeginProc glBegin = null;
        delegate void glEndProc();
        static glEndProc glEnd = null;
        delegate void glVertex3fProc(float x,float y,float z);
        static glVertex3fProc glVertex3f = null;
        delegate void glColor3fProc(float r,float g,float b);
        static glColor3fProc glColor3f = null;
        delegate void glColor4fProc(float r,float g,float b,float a);
        static glColor4fProc glColor4f = null;
        delegate void glNormal3fProc(float x,float y,float z);
        static glNormal3fProc glNormal3f = null;
        delegate void glTexCoord2fProc(float u,float v);
        static glTexCoord2fProc glTexCoord2f = null;
        delegate void glBindTextureProc(uint target,uint tex);
        static glBindTextureProc glBindTexture = null;
        delegate void glGenTexturesProc(int count,out uint tex);
        static glGenTexturesProc glGenTextures = null;
        delegate void glTexParameteriProc(uint target,uint name,int v);
        static glTexParameteriProc glTexParameteri = null;
        delegate void glTexImage2DProc(uint target,int level,int comp,int w,int h,int border,uint format,uint type,IntPtr data);
        static glTexImage2DProc glTexImage2D = null;
        delegate void glTexSubImage2DProc(uint target,int level,int x,int y,int w,int h,uint format,uint type,IntPtr data);
        static glTexSubImage2DProc glTexSubImage2D = null;
        delegate void glPixelStoreiProc(uint name,int value);
        static glPixelStoreiProc glPixelStorei = null;
        delegate void glGetIntegervProc(uint name,out int value);
        static glGetIntegervProc glGetIntegerv = null;
        delegate void glBlendFuncProc(uint src,uint dst);
        static glBlendFuncProc glBlendFunc = null;
        delegate void glDepthMaskProc(byte enabled);
        static glDepthMaskProc glDepthMask = null;
        delegate void glDepthFuncProc(uint func);
        static glDepthFuncProc glDepthFunc = null;
        delegate void glLightfvProc(uint light,uint param,float[] value);
        static glLightfvProc glLightfv = null;
        delegate void glLightModelfvProc(uint param,float[] value);
        static glLightModelfvProc glLightModelfv = null;
        delegate void glColorMaterialProc(uint face,uint mode);
        static glColorMaterialProc glColorMaterial = null;
        delegate void glFogfvProc(uint name,float[] v);
        static glFogfvProc glFogfv = null;
        delegate void glFogiProc(uint name,int v);
        static glFogiProc glFogi = null;
        delegate void glFogfProc(uint name,float v);
        static glFogfProc glFogf = null;
        delegate void glLineWidthProc(float v);
        static glLineWidthProc glLineWidth = null;
        delegate uint glGenListsProc(int n);
        static glGenListsProc glGenLists = null;
        delegate void glNewListProc(uint list,uint mode);
        static glNewListProc glNewList = null;
        delegate void glEndListProc();
        static glEndListProc glEndList = null;
        delegate void glCallListProc(uint list);
        static glCallListProc glCallList = null;
        delegate void glEnableClientStateProc(uint cap);
        static glEnableClientStateProc glEnableClientState = null;
        delegate void glDisableClientStateProc(uint cap);
        static glDisableClientStateProc glDisableClientState = null;
        delegate void glVertexPointerProc(int n,uint type,int stride,IntPtr buffer);
        static glVertexPointerProc glVertexPointer = null;
        delegate void glNormalPointerProc(uint type,int stride,IntPtr buffer);
        static glNormalPointerProc glNormalPointer = null;
        delegate void glColorPointerProc(int n,uint type,int stride,IntPtr buffer);
        static glColorPointerProc glColorPointer = null;
        delegate void glTexCoordPointerProc(int n,uint type,int stride,IntPtr buffer);
        static glTexCoordPointerProc glTexCoordPointer = null;
        delegate void glDrawArraysProc(uint mode,int first,int count);
        static glDrawArraysProc glDrawArrays = null;
        delegate void glReadPixelsProc(int x,int y,int w,int h,uint format,uint type,IntPtr data);
        static glReadPixelsProc glReadPixels = null;
        delegate IntPtr glGetStringProc(uint name);
        static glGetStringProc glGetString = null;
        delegate void glMaterialfvProc(uint face,uint name,float[] p);
        static glMaterialfvProc glMaterialfv = null;
        delegate void glMaterialfProc(uint face,uint name,float p);
        static glMaterialfProc glMaterialf = null;
    }
}
