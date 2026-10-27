// signup.js: the sign-up form. Needs js/auth.js loaded first.

// someone who is already signed in has no reason to be on this page
Auth.redirectIfLoggedIn()

const errorMsg = document.getElementById('errorMsg')
let errorTimer = null

// shows an error in the red box for 4 seconds
const showError = (text) => {
    errorMsg.textContent = text
    errorMsg.style.display = 'block'
    clearTimeout(errorTimer)
    errorTimer = setTimeout(() => {
        errorMsg.style.display = 'none'
    }, 4000)
}

const signUp = () => {
    let fName = document.getElementById('firstName').value
    let lName = document.getElementById('lastName').value
    let mail = document.getElementById('emailAddress').value
    let pass = document.getElementById('password').value

    // 1. empty fields
    if (fName.trim() === "" || lName.trim() === "" || mail.trim() === "" || pass.trim() === "") {
        showError('All inputs are required')
        return
    }

    // 2. create the account (Auth checks the email and password, rejects a repeated email,
    //    scrambles the password with a salt, saves it in localStorage and sets the role to "user")
    let result = Auth.register(fName, lName, mail, pass)
    if (!result.ok) {
        showError(result.error)
        return
    }

    // 3. sign the new user in, show a message, then go to the store
    Auth.startSession(result.user.id)
    document.getElementById('display').innerHTML = ""
    let box = document.createElement('p')
    box.className = 'msg msg-success'
    box.textContent = 'Account created for ' + result.user.name + '. Taking you to the store...'
    document.getElementById('display').append(box)

    document.getElementById('firstName').value = ""
    document.getElementById('lastName').value = ""
    document.getElementById('emailAddress').value = ""
    document.getElementById('password').value = ""

    setTimeout(() => {
        window.location.href = 'index.html'
    }, 2000)
}
