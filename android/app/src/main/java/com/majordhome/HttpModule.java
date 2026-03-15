package com.majordhome;

import android.os.Handler;
import android.os.Looper;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.Arguments;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class HttpModule extends ReactContextBaseJavaModule {
    private final ExecutorService executor = Executors.newCachedThreadPool();

    HttpModule(ReactApplicationContext context) {
        super(context);
    }

    @Override
    public String getName() {
        return "NativeHttp";
    }

    @ReactMethod
    public void request(String method, String urlString, String body, String headersJson, Promise promise) {
        executor.execute(() -> {
            HttpURLConnection conn = null;
            try {
                URL url = new URL(urlString);
                conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod(method);
                conn.setConnectTimeout(15000);
                conn.setReadTimeout(15000);

                // Parse and set headers
                if (headersJson != null && !headersJson.isEmpty()) {
                    // Simple JSON parsing for {"key":"value",...}
                    String trimmed = headersJson.trim();
                    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
                        trimmed = trimmed.substring(1, trimmed.length() - 1);
                        String[] pairs = trimmed.split(",(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)");
                        for (String pair : pairs) {
                            String[] kv = pair.split(":", 2);
                            if (kv.length == 2) {
                                String key = kv[0].trim().replaceAll("^\"|\"$", "");
                                String val = kv[1].trim().replaceAll("^\"|\"$", "");
                                conn.setRequestProperty(key, val);
                            }
                        }
                    }
                }

                // Send body if present
                if (body != null && !body.isEmpty() && (method.equals("POST") || method.equals("PUT") || method.equals("PATCH"))) {
                    conn.setDoOutput(true);
                    OutputStream os = conn.getOutputStream();
                    os.write(body.getBytes("UTF-8"));
                    os.flush();
                    os.close();
                }

                int status = conn.getResponseCode();

                // Read response
                BufferedReader reader;
                if (status >= 200 && status < 400) {
                    reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                } else {
                    reader = new BufferedReader(new InputStreamReader(conn.getErrorStream()));
                }

                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    sb.append(line);
                }
                reader.close();

                WritableMap result = Arguments.createMap();
                result.putInt("status", status);
                result.putString("data", sb.toString());
                promise.resolve(result);
            } catch (Exception e) {
                promise.reject("HTTP_ERROR", e.getMessage(), e);
            } finally {
                if (conn != null) {
                    conn.disconnect();
                }
            }
        });
    }
}
