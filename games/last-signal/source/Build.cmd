@echo off
setlocal
pushd "%~dp0"
"%SystemRoot%\Microsoft.NET\Framework64\v4.0.30319\csc.exe" /nologo /target:winexe /platform:x64 /optimize+ /main:LastSignal.Program /win32manifest:arena.manifest /win32icon:arena.ico /out:"..\Last Signal.exe" /r:System.Web.Extensions.dll /r:System.Drawing.dll /r:System.Windows.Forms.dll *.cs
set "build_result=%errorlevel%"
popd
exit /b %build_result%
