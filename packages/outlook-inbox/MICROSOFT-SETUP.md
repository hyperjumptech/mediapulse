# Complete Setup Guide: Microsoft Graph API with Application Permissions

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Azure Portal Setup](#azure-portal-setup)
3. [PowerShell Setup on Mac](#powershell-setup-on-mac)
4. [Exchange Online Configuration](#exchange-online-configuration)
5. [Verification & Testing](#verification--testing)
6. [Troubleshooting](#troubleshooting)
7. [Security Best Practices](#security-best-practices)

---

## Prerequisites

### Required Access & Accounts

- **Azure AD/Microsoft Entra Admin Access**: You need Global Administrator or Application Administrator role
- **Exchange Online Admin Access**: Required for mailbox access policies
- **Microsoft 365 Subscription**: With Exchange Online
- **Shared Mailbox**: Already created in Exchange (e.g., support@company.com)

### Required Information to Collect

You'll need to note down these values during setup:

- ✅ Tenant ID (Directory ID)
- ✅ Application (Client) ID
- ✅ Client Secret Value
- ✅ Shared Mailbox Email Address

---

## Azure Portal Setup

### Part 1: Create App Registration

1. **Navigate to Azure Portal**
   - Go to [https://portal.azure.com](https://portal.azure.com)
   - Sign in with your admin account

2. **Access App Registrations**
   - In the left sidebar, click **Microsoft Entra ID** (formerly Azure Active Directory)
   - In the left menu under **Manage**, click **App registrations**
   - Click **+ New registration** at the top

3. **Register the Application**
   - **Name**: Enter a descriptive name (e.g., "Email Automation Service" or "Shared Mailbox Manager")
   - **Supported account types**: Select **Accounts in this organizational directory only (Single tenant)**
   - **Redirect URI**: Leave blank (not needed for application permissions)
   - Click **Register**

4. **Copy Important Values**
   - You'll be taken to the app's Overview page
   - **Copy and save these values** (you'll need them later):
     - **Application (client) ID**: A GUID like `12345678-1234-1234-1234-123456789abc`
     - **Directory (tenant) ID**: A GUID like `87654321-4321-4321-4321-cba987654321`

### Part 2: Configure API Permissions

1. **Navigate to API Permissions**
   - In your app registration, click **API permissions** in the left menu (under **Manage**)

2. **Remove Default Permissions**
   - You'll see **User.Read** (Delegated) permission by default
   - Click the **...** (three dots) next to it
   - Click **Remove permission**
   - Confirm the removal

3. **Add Application Permissions**
   - Click **+ Add a permission**
   - Click **Microsoft Graph**
   - Click **Application permissions** (NOT Delegated permissions)

4. **Select Mail Permissions**
   - In the search box, type "mail"
   - Expand **Mail** section
   - Check these permissions:
     - ☑ **Mail.Read** - Read mail in all mailboxes
     - ☑ **Mail.ReadWrite** - Read and write mail in all mailboxes
   - Click **Add permissions** at the bottom

5. **Grant Admin Consent** (CRITICAL STEP)
   - Back on the API permissions page, you'll see your new permissions with status "Not granted"
   - Click **✓ Grant admin consent for [Your Organization Name]**
   - Click **Yes** in the confirmation dialog
   - Wait for the status to change to "Granted for [Your Organization]" (green checkmark)

### Part 3: Create Client Secret

1. **Navigate to Certificates & Secrets**
   - In your app registration, click **Certificates & secrets** in the left menu (under **Manage**)

2. **Create New Client Secret**
   - Click the **Client secrets** tab
   - Click **+ New client secret**
   - **Description**: Enter something descriptive (e.g., "Production Secret" or "Mac App Secret")
   - **Expires**: Choose an expiration period:
     - **Recommended**: 180 days (6 months) or 365 days (1 year) for better security
     - **Maximum**: 730 days (2 years)
     - **Note**: You'll need to create a new secret before expiration
   - Click **Add**

3. **Copy the Secret Value** (IMPORTANT!)
   - The secret will appear with a **Value** and **Secret ID**
   - **IMMEDIATELY copy the Value** (the long string in the Value column)
   - **⚠️ CRITICAL**: This value is only shown ONCE. If you navigate away, you'll never see it again and will need to create a new secret
   - Store it securely (password manager, Azure Key Vault, or secure note)

---

## PowerShell Setup on Mac

In order to limit the access to the shared mailbox to the application, we need to create an application access policy. For this, we need to use PowerShell.

### Part 1: Install PowerShell

1. **Check if Homebrew is Installed**

   ```bash
   brew --version
   ```

2. **Install Homebrew** (if not installed)

   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```

   - Follow the on-screen instructions
   - May take 5-10 minutes

3. **Install PowerShell**

   ```bash
   brew install --cask powershell
   ```

4. **Verify Installation**

   ```bash
   pwsh --version
   ```

   - Should show: PowerShell 7.x.x

### Part 2: Install Exchange Online Management Module

1. **Launch PowerShell**

   ```bash
   pwsh
   ```

   - Your terminal prompt should change to `PS /Users/yourusername>`

2. **Install Exchange Online Module**

   ```powershell
   Install-Module -Name ExchangeOnlineManagement -Scope CurrentUser
   ```

3. **Handle Installation Prompts**
   - **Untrusted repository warning**: Type `Y` and press Enter
   - **NuGet provider**: If prompted, type `Y` and press Enter
   - Installation may take 2-5 minutes

4. **Verify Installation**

   ```powershell
   Get-Module -ListAvailable ExchangeOnlineManagement
   ```

   - Should show the module version

5. **Set Execution Policy** (if needed)

   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```

   - Type `Y` if prompted

---

## Exchange Online Configuration

### Part 1: Connect to Exchange Online

1. **Launch PowerShell** (if not already open)

   ```bash
   pwsh
   ```

2. **Connect to Exchange Online**

   ```powershell
   Connect-ExchangeOnline -UserPrincipalName your-admin@yourdomain.com
   ```

   - Replace `your-admin@yourdomain.com` with your actual admin email
   - A browser window will open for authentication
   - Sign in with your admin account
   - Complete any MFA (Multi-Factor Authentication) if required
   - You should see: "Connected to Exchange Online"

3. **Verify Connection**

   ```powershell
   Get-OrganizationConfig | Select-Object Name
   ```

   - Should display your organization name

### Part 2: Create Mail-Enabled Security Group

1. **Create the Security Group**

   ```powershell
   New-DistributionGroup -Name "GraphAPIAccessGroup" -Type "Security" -PrimarySmtpAddress "graphapiaccess@yourdomain.com"
   ```

   - Replace `yourdomain.com` with your actual domain
   - **Name**: Can be any descriptive name (e.g., "GraphAPIAccessGroup", "AutomationMailboxes")
   - **PrimarySmtpAddress**: Must be a valid email format in your domain

2. **Verify Group Creation**

   ```powershell
   Get-DistributionGroup -Identity "GraphAPIAccessGroup"
   ```

   - Should display the group details

### Part 3: Add Mailboxes to the Group

1. **Add Your Shared Mailbox**

   ```powershell
   Add-DistributionGroupMember -Identity "GraphAPIAccessGroup" -Member "support@company.com"
   ```

   - Replace `support@company.com` with your actual shared mailbox email

2. **Add Multiple Mailboxes** (if needed)

   ```powershell
   Add-DistributionGroupMember -Identity "GraphAPIAccessGroup" -Member "sales@company.com"
   Add-DistributionGroupMember -Identity "GraphAPIAccessGroup" -Member "info@company.com"
   ```

3. **Verify Members**

   ```powershell
   Get-DistributionGroupMember -Identity "GraphAPIAccessGroup"
   ```

   - Should list all mailboxes you added

### Part 4: Create Application Access Policy

1. **Create the Policy**

   ```powershell
   New-ApplicationAccessPolicy -AppId "YOUR_CLIENT_ID" -PolicyScopeGroupId "graphapiaccess@yourdomain.com" -AccessRight RestrictAccess -Description "Restrict Graph API to specific mailboxes only"
   ```

   - Replace `YOUR_CLIENT_ID` with the Application (client) ID from Azure Portal
   - Replace `graphapiaccess@yourdomain.com` with the group email you created
   - **AccessRight**: Must be `RestrictAccess`
   - **Description**: Can be any descriptive text

2. **Verify Policy Creation**

   ```powershell
   Get-ApplicationAccessPolicy
   ```

   - Should show your newly created policy with:
     - AppId: Your client ID
     - PolicyScopeGroupId: Your group email
     - AccessRight: RestrictAccess

### Part 5: Test the Policy

1. **Test Access to Allowed Mailbox**

   ```powershell
   Test-ApplicationAccessPolicy -Identity "support@company.com" -AppId "YOUR_CLIENT_ID"
   ```

   - Expected result: `AccessCheckResult : Granted`

2. **Test Access to Non-Allowed Mailbox**

   ```powershell
   Test-ApplicationAccessPolicy -Identity "someuser@company.com" -AppId "YOUR_CLIENT_ID"
   ```

   - Expected result: `AccessCheckResult : Denied`
   - This confirms the policy is working correctly

3. **Disconnect from Exchange Online**

   ```powershell
   Disconnect-ExchangeOnline
   ```

   - Type `Y` to confirm

### Test Policy After 10-15 Minutes

**Important**: Application access policies can take 10-15 minutes to fully propagate. If testing immediately fails, wait and try again.

---

## Troubleshooting

### Azure Portal Issues

#### "Insufficient privileges to complete the operation"

- **Cause**: You don't have admin rights
- **Solution**: Contact your Global Administrator or ask them to perform the setup

#### "Admin consent required" error in app

- **Cause**: Admin consent not granted
- **Solution**: Go back to API permissions → Click "Grant admin consent"

#### Can't find "Microsoft Entra ID"

- **Cause**: Portal UI updated
- **Solution**: Look for "Azure Active Directory" or use the search bar at the top

#### Client secret not visible after creation

- **Cause**: Navigated away from the page
- **Solution**: Delete the old secret and create a new one (you can't retrieve the old value)

### PowerShell Issues

#### "brew: command not found"

- **Cause**: Homebrew not installed
- **Solution**: Install Homebrew first (see Part 1 of PowerShell setup)

#### "pwsh: command not found"

- **Cause**: PowerShell not installed or not in PATH
- **Solution**:
  - Try closing and reopening Terminal
  - Reinstall PowerShell
  - Try full path: `/usr/local/bin/pwsh`

#### "Install-Module: The term 'Install-Module' is not recognized"

- **Cause**: Running in bash instead of PowerShell
- **Solution**: Make sure you launched PowerShell with `pwsh` command

#### "Cannot install module - untrusted repository"

- **Cause**: PSGallery not trusted
- **Solution**: Type `Y` when prompted, or run:
  ```powershell
  Set-PSRepository -Name PSGallery -InstallationPolicy Trusted
  ```

#### "Connect-ExchangeOnline: The term is not recognized"

- **Cause**: Module not installed or not loaded
- **Solution**:
  ```powershell
  Import-Module ExchangeOnlineManagement
  Connect-ExchangeOnline -UserPrincipalName your-admin@yourdomain.com
  ```

### Exchange Online Issues

#### "User not authorized to perform this operation"

- **Cause**: Not an Exchange admin
- **Solution**: You need Exchange Administrator or Global Administrator role

#### "New-DistributionGroup: A distribution group with this name already exists"

- **Cause**: Group name already in use
- **Solution**: Use a different name or check existing groups:
  ```powershell
  Get-DistributionGroup | Where-Object {$_.Name -like "*Graph*"}
  ```

#### "Add-DistributionGroupMember: The recipient doesn't exist"

- **Cause**: Mailbox email address is incorrect
- **Solution**: Verify the mailbox exists:
  ```powershell
  Get-Mailbox -Identity "support@company.com"
  ```

#### "New-ApplicationAccessPolicy: A policy for this AppId already exists"

- **Cause**: Policy already created
- **Solution**: View existing policy or remove and recreate:
  ```powershell
  Get-ApplicationAccessPolicy
  Remove-ApplicationAccessPolicy -Identity "YOUR_CLIENT_ID"
  ```

#### Test-ApplicationAccessPolicy returns "Denied" for allowed mailbox

- **Cause**: Policy not yet propagated (takes 10-15 minutes)
- **Solution**: Wait 15 minutes and test again
- **Alternative Cause**: Mailbox not in the group
- **Solution**: Verify membership:
  ```powershell
  Get-DistributionGroupMember -Identity "GraphAPIAccessGroup"
  ```

---

## Security Best Practices

### Client Secret Management

1. **Never Commit Secrets to Git**
   - Use environment variables
   - Use `.env` files (add to `.gitignore`)
   - Use Azure Key Vault for production

2. **Rotate Secrets Regularly**
   - Set calendar reminders before expiration
   - Create new secret before old one expires
   - Update application configuration
   - Delete old secret after transition

3. **Use Short Expiration Periods**
   - Recommended: 6 months (180 days)
   - Maximum: 2 years (730 days)
   - Never use "Never expires" option

### Application Access Policy

1. **Principle of Least Privilege**
   - Only add mailboxes that absolutely need access
   - Review group membership quarterly
   - Remove unused mailboxes promptly

2. **Regular Audits**
   - Review application access policies monthly
   - Check for unauthorized access attempts
   - Monitor Graph API usage logs

3. **Documentation**
   - Document which app has access to which mailboxes
   - Keep a record of client secret expiration dates
   - Maintain a list of administrators who can modify policies

### Monitoring & Logging

1. **Enable Azure AD Sign-in Logs**
   - Monitor application sign-ins
   - Set up alerts for unusual activity

2. **Exchange Online Audit Logs**
   - Track mailbox access
   - Review message operations (read, delete, move)

3. **Set Up Alerts**
   - Alert on failed authentication attempts
   - Alert on permission changes
   - Alert on policy modifications

---

## Managing Policies Later

### View All Policies

```powershell
Connect-ExchangeOnline -UserPrincipalName admin@yourdomain.com
Get-ApplicationAccessPolicy
```

### Add More Mailboxes to Existing Group

```powershell
Add-DistributionGroupMember -Identity "GraphAPIAccessGroup" -Member "newmailbox@company.com"
```

### Remove Mailbox from Group

```powershell
Remove-DistributionGroupMember -Identity "GraphAPIAccessGroup" -Member "oldmailbox@company.com"
```

### Update Policy (Delete and Recreate)

```powershell
# Remove old policy
Remove-ApplicationAccessPolicy -Identity "YOUR_CLIENT_ID"

# Create new policy
New-ApplicationAccessPolicy -AppId "YOUR_CLIENT_ID" -PolicyScopeGroupId "graphapiaccess@yourdomain.com" -AccessRight RestrictAccess -Description "Updated policy"
```

### Delete Everything (Clean Up)

```powershell
# Remove policy
Remove-ApplicationAccessPolicy -Identity "YOUR_CLIENT_ID"

# Remove group
Remove-DistributionGroup -Identity "GraphAPIAccessGroup"
```

---

## Summary of Values You Need

After completing this setup, you should have:

| Item           | Example Value                          | Where to Find                                            |
| -------------- | -------------------------------------- | -------------------------------------------------------- |
| Tenant ID      | `87654321-4321-4321-4321-cba987654321` | Azure Portal → App Registration → Overview               |
| Client ID      | `12345678-1234-1234-1234-123456789abc` | Azure Portal → App Registration → Overview               |
| Client Secret  | `abc123~XYZ...`                        | Azure Portal → Certificates & secrets (copy immediately) |
| Shared Mailbox | `support@company.com`                  | Exchange Admin Center or your IT team                    |
| Group Email    | `graphapiaccess@yourdomain.com`        | Created in PowerShell                                    |

Store these values securely and use them in your Node.js application configuration.

---

**Setup Complete!** Your application can now access the specified shared mailboxes with no user interaction required.
