Add-Type -TypeDefinition @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public class ShellThumbnail {
    [DllImport("shell32.dll", CharSet = CharSet.Unicode, PreserveSig = false)]
    public static extern void SHCreateItemFromParsingName(
        [In] string pszPath,
        [In] IntPtr pbc,
        [In] ref Guid riid,
        [Out, MarshalAs(UnmanagedType.Interface)] out IShellItem ppv
    );

    [ComImport]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    [Guid("43826d1e-e718-42ee-bc55-a1e261c37bfe")]
    public interface IShellItem {
        void BindToHandler(IntPtr pbc, ref Guid bhid, ref Guid riid, out IntPtr ppv);
        void GetParent(out IShellItem ppsi);
        void GetDisplayName(uint sigdnName, out IntPtr ppszName);
        void GetAttributes(uint sfgaoMask, out uint psfgaoAttribs);
        void Compare(IShellItem psi, uint hint, out int piOrder);
    }

    [ComImport]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    [Guid("bcc18b79-ba16-442f-80c4-8a59c30c463b")]
    public interface IShellItemImageFactory {
        [PreserveSig]
        int GetImage(
            [In, MarshalAs(UnmanagedType.Struct)] SIZE size,
            [In] int flags,
            [Out] out IntPtr phbm
        );
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct SIZE {
        public int cx;
        public int cy;
        public SIZE(int cx, int cy) { this.cx = cx; this.cy = cy; }
    }

    public static void SaveThumbnail(string videoPath, string outputPath, int width, int height) {
        Guid shellItemGuid = new Guid("43826d1e-e718-42ee-bc55-a1e261c37bfe");
        IShellItem shellItem;
        SHCreateItemFromParsingName(videoPath, IntPtr.Zero, ref shellItemGuid, out shellItem);
        IShellItemImageFactory factory = (IShellItemImageFactory)shellItem;
        IntPtr hBitmap;
        // flags: 0x0 (SIIGBF_RESIZETOFIT)
        int hr = factory.GetImage(new SIZE(width, height), 0x0, out hBitmap);
        if (hr != 0) {
            // try SIIGBF_BIGGERSIZEOK | SIIGBF_THUMBNAILONLY
            hr = factory.GetImage(new SIZE(width, height), 0x1, out hBitmap);
        }
        if (hr != 0) {
            throw new Exception("GetImage failed with hr = " + hr);
        }
        using (Bitmap bmp = Bitmap.FromHbitmap(hBitmap)) {
            bmp.Save(outputPath, ImageFormat.Jpeg);
        }
    }
}
"@ -ReferencedAssemblies System.Drawing

$video = (Resolve-Path "assets/video/video-dam-cuoi-co-dau-chu-re.mp4").Path
$out = [System.IO.Path]::Combine((Get-Location).Path, "assets/images/video-thumbnail.jpg")
[ShellThumbnail]::SaveThumbnail($video, $out, 1280, 720)
Write-Output "Thumbnail saved to $out"
