package za.co.naleli.z83.app.ui.components

import android.graphics.Bitmap
import android.graphics.Canvas as AndroidCanvas
import android.graphics.Paint as AndroidPaint
import android.util.Base64
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import java.io.ByteArrayOutputStream

/**
 * Captures a drawn signature and hands the caller PNG bytes, base64-encoded
 * — matching what POST /applications/:id/sign expects (see docs/API.md).
 * Nothing about the declaration text lives here; the server owns that.
 */
@Composable
fun SignaturePad(onCapture: (String) -> Unit) {
    var strokes by remember { mutableStateOf(listOf<List<Offset>>()) }
    var currentStroke by remember { mutableStateOf(listOf<Offset>()) }
    var canvasSize by remember { mutableStateOf(IntSize.Zero) }

    Column(verticalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(8.dp)) {
        Canvas(
            modifier = Modifier
                .fillMaxWidth()
                .height(160.dp)
                .background(Color.White)
                .onSizeChanged { canvasSize = it }
                .pointerInput(Unit) {
                    detectDragGestures(
                        onDragStart = { offset -> currentStroke = listOf(offset) },
                        onDrag = { change, _ -> currentStroke = currentStroke + change.position },
                        onDragEnd = {
                            strokes = strokes + listOf(currentStroke)
                            currentStroke = emptyList()
                        },
                    )
                },
        ) {
            for (stroke in strokes + listOf(currentStroke)) {
                if (stroke.size > 1) {
                    val path = Path().apply {
                        moveTo(stroke[0].x, stroke[0].y)
                        for (point in stroke.drop(1)) lineTo(point.x, point.y)
                    }
                    drawPath(
                        path,
                        color = Color.Black,
                        style = Stroke(width = 5f, cap = StrokeCap.Round, join = StrokeJoin.Round),
                    )
                }
            }
        }

        Row(horizontalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(8.dp)) {
            OutlinedButton(onClick = {
                strokes = emptyList()
                currentStroke = emptyList()
            }) {
                Text("Clear")
            }
            Button(
                enabled = strokes.isNotEmpty() && canvasSize.width > 0 && canvasSize.height > 0,
                onClick = { onCapture(renderToBase64(strokes, canvasSize)) },
            ) {
                Text("Use this signature")
            }
        }
    }
}

private fun renderToBase64(strokes: List<List<Offset>>, size: IntSize): String {
    val bitmap = Bitmap.createBitmap(size.width, size.height, Bitmap.Config.ARGB_8888)
    val canvas = AndroidCanvas(bitmap)
    canvas.drawColor(android.graphics.Color.WHITE)
    val paint = AndroidPaint().apply {
        color = android.graphics.Color.BLACK
        strokeWidth = 5f
        style = AndroidPaint.Style.STROKE
        strokeCap = AndroidPaint.Cap.ROUND
        strokeJoin = AndroidPaint.Join.ROUND
        isAntiAlias = true
    }
    for (stroke in strokes) {
        for (i in 0 until stroke.size - 1) {
            canvas.drawLine(stroke[i].x, stroke[i].y, stroke[i + 1].x, stroke[i + 1].y, paint)
        }
    }
    val output = ByteArrayOutputStream()
    bitmap.compress(Bitmap.CompressFormat.PNG, 100, output)
    return Base64.encodeToString(output.toByteArray(), Base64.NO_WRAP)
}
