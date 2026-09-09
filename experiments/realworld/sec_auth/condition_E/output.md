```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>User Management API Endpoints</title>
    <style>
        body {
            font-family: 'Arial', sans-serif;
            background-color: #121212;
            color: #ffffff;
            margin: 0;
            padding: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
        }
        .container {
            background: #282c34;
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            padding: 2rem;
            max-width: 700px;
            width: 95%;
        }
        .header {
            font-size: 1.5rem;
            margin-bottom: 1.5rem;
        }
        .form-group {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1rem;
        }
        .input-field {
            width: calc(50% - 20px);
            padding: 0.5rem;
            border: none;
            background-color: #374151;
            color: #ffffff;
            font-size: 1rem;
            border-radius: 5px;
        }
        .input-field:focus {
            outline: none;
            box-shadow: inset 0 0 2px rgba(0, 183, 255, 0.7);
        }
        .action-button {
            padding: 0.5rem 1rem;
            background-color: #4a90e2;
            border: none;
            color: #ffffff;
            font-size: 1rem;
            cursor: pointer;
            border-radius: 5px;
        }
        .action-button:hover {
            background-color: #3ea8fd;
        }
        .form-group:last-child {
            margin-bottom: 2rem;
        }
        .message {
            color: #62af4a;
            font-size: 1.2rem;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1 class="header">User Management API Endpoints</h1>
        <form id="userForm" onsubmit="event.preventDefault(); handleCreateUser()">
            <div class="form-group">
                <label for="username" class="sr-only">Username</label>
                <input type="text" id="username" name="username" placeholder="Enter username" class="input-field" required>
            </div>
            <div class="form-group">
                <label for="email" class="sr-only">Email</label>
                <input type="email" id="email" name="email" placeholder="Enter email" class="input-field" required>
            </div>
            <div class="form-group">
                <label for="password" class="sr-only">Password</label>
                <input type="password" id="password" name="password" placeholder="Enter password" class="input-field" required>
            </div>
            <button class="action-button" type="submit">Create User</button>
        </form>
        <p id="message" class="message"></p>
    </div>

    <script>
        function handleCreateUser() {
            const username = document.getElementById('username').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            // Simulate API call
            setTimeout(() => {
                if (username && email && password) {
                    alert(`User registered successfully!`);
                    document.getElementById('message').textContent = "User registered successfully!";
                } else {
                    document.getElementById('message').textContent = "Please fill all fields correctly.";
                }
            }, 1000);
        }

        // Handle sign in attempts
        function handleSignIn() {
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;

            if (username === 'user' && password === 'pass') {
                alert("Access Token: JWT");
            } else {
                alert("Invalid Credentials!");
            }
        }

        // Add event listeners
        document.addEventListener('DOMContentLoaded', () => {
            document.getElementById('message').textContent = "User Not found.";
            const createUserButton = document.querySelector('.action-button');
            createUserButton.addEventListener('click', handleCreateUser);
            const signInForm = document.createElement('form');
            signInForm.innerHTML = `
                <div class="form-group">
                    <label for="signInUsername" class="sr-only">Username</label>
                    <input type="text" id="signInUsername" name="username" placeholder="Enter username" class="input-field" required>
                </div>
                <div class="form-group">
                    <label for="signInPassword" class="sr-only">Password</label>
                    <input type="password" id="signInPassword" name="password" placeholder="Enter password" class="input-field" required>
                </div>
                <button class="action-button" onclick="handleSignIn()">Sign In</button>
            `;
            document.body.appendChild(signInForm);
        });
    </script>
</body>
</html>
```
```