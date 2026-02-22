import validator from 'validator';

const validateUsername = (username) => {

    if (!username || typeof username !== 'string')
        return 'Username is required.';

    if (username.length < 3 || username.length > 32)
        return 'Username must be between 3 and 32 characters.';

    if (!/^[a-zA-Z0-9_.]+$/.test(username))
        return 'Username can only contain letters, numbers, underscores, and dots.';

    if (['admin', 'root', 'system'].includes(username.toLowerCase()))
        return 'Did you also set your password to "password"?';

    return '';
}


const validateEmail = (email) => {

    if (!email || typeof email !== 'string')
        return 'Email is required.';

    else if (!validator.isEmail(email))
        return 'Invalid email format.';

    return '';
}


const validatePassword = (password) => {
    const pwdRules = [
        { regexp: /[a-z]/, msg: "Password must contain at least one lowercase letter." },
        { regexp: /[A-Z]/, msg: "Password must contain at least one uppercase letter." },
        { regexp: /\d/, msg: "Password must contain at least one digit." },
        { regexp: /[-#!$@£%^&*()_+|~=`{}\[\]:";'<>?,.\/\\ ]/, msg: "Password must contain at least one special character." }
    ];
    let errormessage = '';

    if (!password || password.length < 8 || password.length > 64)
        errormessage = 'Password must be between 8 and 64 characters long.';

    for (const { regexp,msg } of pwdRules) {
        if (!regexp.test(password)) {
            errormessage = msg
        }
    }

    return errormessage;
}

export { validateUsername, validateEmail, validatePassword };
