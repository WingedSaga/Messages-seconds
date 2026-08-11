package org.messagesseconds.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.media.AudioDeviceInfo;
import android.media.AudioManager;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.SslErrorHandler;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public final class MainActivity extends Activity {
  private static final String HOME_URL = "https://wingedsaga.github.io/Messages-seconds/";
  private static final int MEDIA_PERMISSION_REQUEST = 10;
  private WebView webView;
  private AudioManager audioManager;

  @SuppressLint("SetJavaScriptEnabled")
  @Override public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
    webView = new WebView(this);
    setContentView(webView);
    WebSettings settings = webView.getSettings();
    settings.setJavaScriptEnabled(true);
    settings.setDomStorageEnabled(true);
    settings.setMediaPlaybackRequiresUserGesture(true);
    settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
    settings.setAllowFileAccess(false);
    settings.setAllowContentAccess(false);
    webView.addJavascriptInterface(new AndroidAudio(), "AndroidAudio");
    webView.setWebViewClient(new WebViewClient() {
      @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        Uri uri = request.getUrl();
        if ("https".equals(uri.getScheme()) && isTrustedHost(uri.getHost())) return false;
        startActivity(new Intent(Intent.ACTION_VIEW, uri)); return true;
      }
      @Override public void onReceivedSslError(WebView view, SslErrorHandler handler, android.net.http.SslError error) { handler.cancel(); }
    });
    webView.setWebChromeClient(new WebChromeClient() {
      @Override public void onPermissionRequest(PermissionRequest request) {
        if (!isTrustedHost(request.getOrigin().getHost())) { request.deny(); return; }
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED || checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
          requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO, Manifest.permission.CAMERA}, MEDIA_PERMISSION_REQUEST);
          request.deny(); return;
        }
        request.grant(request.getResources());
      }
    });
    if (android.os.Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 11);
    webView.loadUrl(HOME_URL);
  }

  private static boolean isTrustedHost(String host) { return "wingedsaga.github.io".equals(host); }

  public final class AndroidAudio {
    @JavascriptInterface public void setSpeakerEnabled(boolean enabled) {
      runOnUiThread(() -> {
        audioManager.setMode(AudioManager.MODE_IN_COMMUNICATION);
        if (android.os.Build.VERSION.SDK_INT >= 31) {
          AudioDeviceInfo target = null;
          for (AudioDeviceInfo device : audioManager.getAvailableCommunicationDevices()) {
            if (enabled && device.getType() == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER) target = device;
            if (!enabled && device.getType() == AudioDeviceInfo.TYPE_BUILTIN_EARPIECE) target = device;
          }
          if (target != null) audioManager.setCommunicationDevice(target);
        } else {
          audioManager.setSpeakerphoneOn(enabled);
        }
      });
    }
  }

  @Override public void onBackPressed() { if (webView.canGoBack()) webView.goBack(); else super.onBackPressed(); }
}
