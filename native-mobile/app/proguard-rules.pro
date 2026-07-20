# Add project specific ProGuard rules here.
# By default, the noise of code obfuscation is set in proguard-android-optimize.txt.
# Keeping custom WebView settings
-keepclassmembers class * extends android.webkit.WebViewClient {
    public void *(***);
}
-keepclassmembers class * extends android.webkit.WebChromeClient {
    public void *(***);
}
