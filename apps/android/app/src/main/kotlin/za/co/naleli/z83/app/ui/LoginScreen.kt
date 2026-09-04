package za.co.naleli.z83.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import za.co.naleli.z83.app.network.ApiClient
import za.co.naleli.z83.shared.User

@Composable
fun LoginScreen(apiClient: ApiClient, onLoggedIn: (User) -> Unit, onGoToRegister: () -> Unit = {}) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var loading by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.Center,
    ) {
        Text("Z83", style = androidx.compose.material3.MaterialTheme.typography.headlineMedium)
        Text("Fill once. Apply many times.")

        androidx.compose.foundation.layout.Spacer(modifier = Modifier.padding(top = 24.dp))

        OutlinedTextField(
            value = email,
            onValueChange = { email = it },
            label = { Text("Email") },
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = password,
            onValueChange = { password = it },
            label = { Text("Password") },
            visualTransformation = PasswordVisualTransformation(),
            modifier = Modifier.fillMaxWidth(),
        )

        error?.let {
            Text(it, color = androidx.compose.material3.MaterialTheme.colorScheme.error)
        }

        Button(
            onClick = {
                loading = true
                error = null
                scope.launch {
                    try {
                        val user = apiClient.login(email, password)
                        onLoggedIn(user)
                    } catch (e: ApiClient.ApiException) {
                        error = e.message
                    } finally {
                        loading = false
                    }
                }
            },
            modifier = Modifier.fillMaxWidth(),
        ) {
            if (loading) CircularProgressIndicator(modifier = Modifier.padding(4.dp))
            else Text("Sign in")
        }

        TextButton(onClick = onGoToRegister, modifier = Modifier.fillMaxWidth()) {
            Text("No profile yet? Create one")
        }
    }
}
