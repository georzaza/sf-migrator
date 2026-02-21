## Prerequisites
registered nameservers for the domain georgezazanis.org 

## 1. install cloudflare
`winget install Cloudflare.cloudflared`

## 2. Tunnel authorization
`cloudflared tunnel login`


## 3. Create tunnel and note the generate ID
`cloudflared tunnel create sf-migrator`

## 4. Create CNAME records
```
cloudflared tunnel route dns sf-migrator sf-migrator-backend.georgezazanis.org
cloudflared tunnel route dns sf-migrator sf-migrator-frontend.georgezazanis.org
```
<i> Cloudflare free certs support only up to 1 level down </i> 

## 5. Create config
```
tunnel: <TUNNEL-ID>
credentials-file: C:\Users\<username>\.cloudflared\<TUNNEL-ID>.json

ingress:
  - hostname: sf-migrator.backend.georgezazanis.org
    service: http://localhost:3000
  - hostname: sf-migrator.frontend.georgezazanis.org
    service: http://localhost:5173
  - service: http_status:404
```

## 6. (Optional) Create a Page rule in Cloudflare (TBD if required)
Cache Level: Bypass
Rocket Loader: Off
Browser Cache TTL: 2 minutes

## 7. Launch the tunnel
`cloudflared tunnel --config "C:\Users\<username>\.cloudflared\config.yaml" run sf-migrator`

## 8. Run server & frontend locally
```
npm run start:dev
npm run dev
```
or just `npm run dev:all` while on root (powershell script)


## Other

### Authorization cert is stored at
C:\Users\<username>\.cloudflared\cert.pem

### Installation as a service
cloudflared service install
