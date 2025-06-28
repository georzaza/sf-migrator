fetch('http://localhost:3000/auth/login', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'action': 'login'
    },
    credentials: 'include',
    body: JSON.stringify({
        userIdentifier: 'demo@demo.com',
        password: 'demoPassword'
    })
})
.then(response => response.json())
.then(data => console.log(data))
.catch(err => console.error(err));


fetch('http://localhost:3000/', {
    method: 'GET',
    headers: {
        'action': 'get-orgs'
    },
    credentials: 'include'
})
.then(response => response.json())
.then(data => console.log(data))
.catch(err => console.error(err));


fetch('http://localhost:3000/', {
    method: 'GET',
    headers: {
        'action': 'get-projects'
    },
    credentials: 'include'
})
.then(response => response.json())
.then(data => console.log(data))
.catch(err => console.error(err));
