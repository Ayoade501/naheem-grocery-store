// signin.js: the sign-in form. Needs js/auth.js loaded first.

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

const signIn = () => {
    let mail = document.getElementById('emailAddress').value
    let pass = document.getElementById('password').value

    // 1. empty fields
    if (mail.trim() === "" || pass.trim() === "") {
        showError('All inputs are required')
        return
    }

    // 2. check the details against the accounts saved at sign-up
    let result = Auth.login(mail, pass)

    if (!result.ok) {
        document.getElementById('password').value = ""
        if (result.reason === 'locked') {
            showError('Too many wrong attempts. Wait ' + result.seconds + ' seconds and try again.')
        } else {
            showError('Invalid email or password')      // never say which one was wrong
        }
        return
    }

    // 3. match found: sign in, show a message, then go to the right page
    Auth.startSession(result.user.id)
    document.getElementById('display').innerHTML = ""
    let box = document.createElement('p')
    box.className = 'msg msg-success'
    box.textContent = 'Welcome back, ' + result.user.name + '!'
    document.getElementById('display').append(box)

    document.getElementById('emailAddress').value = ""
    document.getElementById('password').value = ""

    // admins go to the admin page, everyone else goes to the store
    setTimeout(() => {
        window.location.href = Auth.homeFor(result.user)
    }, 1500)
}
