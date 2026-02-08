1. Setup --> Identity --> OAuth and OpenID Connect Settings
    - Enable "Allow OAuth Username-Password Flows"

2. Setup --> External Client Apps --> Settings
    - Enable "Allow creation of connected apps"
    - "New Connected App"
    - - Name:SF Migrator Connected App
    - - Email:your email
    - - Enable OAuth Settings:Enabled
    - - Enable for Device Flow:Enabled
    - - Callback URL:https://login.salesforce.com/services/oauth2/success
    - - Add "Perform requests at any time (refresh_token, offline_access)" and "Full access" to the OAuth Scopes.
    - - Require PKCE: Disabled
    - - Require Secret for Web Server Flow: Enabled
    - - Require Secret for Refresh Token Flow: Enabled
    - - Enable Client Credentials Flow: Enabled
    - - Enable Authorization Code and Credentials Flow: Enabled
    - - Enable Token Exchange Flow: Enabled
    - - Save
    - Wait up to 10 minutes
    - Click "Manage"
    - Click "Edit Policies"
    - Set "IP Relaxation: Relax IP restrictions"
    - Optionally select "Refresh token is valid until revoke"
    - Click Save
    - Navigate to Setup --> Apps --> App Manager, find the app and click on "View"
    - Click "Manager Consumer Details"
    - Copy the Consumer Key & Consumer Secret and create/update the related org in the sf-migrator application.

