package com.vidnex.app

import android.Manifest
import android.app.DownloadManager
import android.content.Context
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.Button
import androidx.compose.material.MaterialTheme
import androidx.compose.material.OutlinedTextField
import androidx.compose.material.Surface
import androidx.compose.material.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import java.net.URL

class MainActivity : ComponentActivity() {
    private var pendingUrl: String? = null
    private val notificationPermission = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        pendingUrl?.let { startDownload(it) }
        pendingUrl = null
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            var url by remember { mutableStateOf("") }
            Surface(color = MaterialTheme.colors.background, modifier = Modifier.fillMaxSize()) {
                Column(
                    modifier = Modifier.fillMaxSize().padding(24.dp),
                    verticalArrangement = Arrangement.Center
                ) {
                    Text("VIDNEX", style = MaterialTheme.typography.h4)
                    Spacer(Modifier.height(8.dp))
                    Text("Background video downloads")
                    Spacer(Modifier.height(24.dp))
                    OutlinedTextField(
                        value = url,
                        onValueChange = { url = it },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text("Direct video URL") },
                        placeholder = { Text("https://example.com/video.mp4") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
                        singleLine = true
                    )
                    Spacer(Modifier.height(16.dp))
                    Button(
                        onClick = { requestOrStart(url.trim()) },
                        modifier = Modifier.fillMaxWidth()
                    ) { Text("Download") }
                    Spacer(Modifier.height(16.dp))
                    Text("Downloads continue in the Android system after you minimize the app or turn off the screen. Use direct media links you own or are allowed to save.")
                }
            }
        }
    }

    private fun requestOrStart(raw: String) {
        val parsed = runCatching { URL(raw) }.getOrNull()
        val path = parsed?.path?.lowercase().orEmpty()
        val allowed = parsed != null &&
            (parsed.protocol == "https" || parsed.protocol == "http") &&
            parsed.host.isNotBlank() &&
            listOf(".mp4", ".webm", ".mov", ".m4v").any { path.endsWith(it) }

        if (!allowed) {
            Toast.makeText(this, "Enter a direct MP4, WebM, MOV or M4V URL.", Toast.LENGTH_LONG).show()
            return
        }

        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            pendingUrl = raw
            notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
        } else {
            startDownload(raw)
        }
    }

    private fun startDownload(raw: String) {
        try {
            val uri = Uri.parse(raw)
            val fileName = uri.lastPathSegment?.takeIf { it.isNotBlank() } ?: "vidnex-video"
            val request = DownloadManager.Request(uri)
                .setTitle(fileName)
                .setDescription("VIDNEX download")
                .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                .setAllowedOverMetered(true)
                .setAllowedOverRoaming(false)
                .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, "VIDNEX/$fileName")

            val manager = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
            manager.enqueue(request)
            Toast.makeText(this, "Download added. Check Android notifications.", Toast.LENGTH_LONG).show()
        } catch (_: Exception) {
            Toast.makeText(this, "Could not start this download.", Toast.LENGTH_LONG).show()
        }
    }
}
