import os
import sys
import time
import paramiko

# Load .env.production if present
def load_env_file(filepath):
    if os.path.isfile(filepath):
        with open(filepath, "r") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, val = line.split("=", 1)
                    key = key.strip()
                    val = val.strip().strip('"').strip("'")
                    if key not in os.environ:
                        os.environ[key] = val

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
load_env_file(os.path.join(ROOT_DIR, ".env.production"))

HOST = os.environ.get("MONSTERASP_HOST", "site108609.siteasp.net")
PORT = int(os.environ.get("MONSTERASP_PORT", "22"))
USER = os.environ.get("MONSTERASP_USER", "site108609")
PASS = os.environ.get("MONSTERASP_PASS", "6h?A_Ec5g8D#")
LOCAL_DIR = os.environ.get("MONSTERASP_LOCAL_DIR", os.path.join(ROOT_DIR, "publish-anycpu"))
REMOTE_BASE = os.environ.get("MONSTERASP_REMOTE_BASE", "wwwroot")

def upload_dir(sftp, local_dir, remote_dir):
    print(f"Ensuring remote directory: {remote_dir}")
    try:
        sftp.mkdir(remote_dir)
    except IOError:
        pass  # Directory already exists

    for item in os.listdir(local_dir):
        local_path = os.path.join(local_dir, item)
        remote_path = f"{remote_dir}/{item}"

        if os.path.isdir(local_path):
            upload_dir(sftp, local_path, remote_path)
        else:
            size_kb = os.path.getsize(local_path) / 1024
            print(f"Uploading {item} ({size_kb:.1f} KB) -> {remote_path}")
            sftp.put(local_path, remote_path)

def main():
    print(f"Connecting to {HOST}:{PORT} as {USER}...")
    transport = paramiko.Transport((HOST, PORT))
    transport.connect(username=USER, password=PASS)
    sftp = paramiko.SFTPClient.from_transport(transport)
    print("Connected successfully via SFTP!")

    # Check and remove iisstart.htm if present
    try:
        sftp.remove(f"{REMOTE_BASE}/iisstart.htm")
        print("Removed default iisstart.htm")
    except IOError:
        pass

    # Put app offline to release any DLL file locks in IIS
    offline_file = f"{REMOTE_BASE}/app_offline.htm"
    try:
        print("Putting app offline temporarily for update...")
        with sftp.file(offline_file, "w") as f:
            f.write("<!doctype html><html><body>Updating NoteBook application...</body></html>")
        time.sleep(2)
    except Exception as e:
        print(f"Note: Could not create app_offline.htm: {e}")

    print(f"\nStarting upload from {LOCAL_DIR} to {REMOTE_BASE}...")
    upload_dir(sftp, LOCAL_DIR, REMOTE_BASE)

    # Clean up obsolete assets in wwwroot/wwwroot/assets
    remote_assets_dir = f"{REMOTE_BASE}/wwwroot/assets"
    local_assets_dir = os.path.join(LOCAL_DIR, "wwwroot", "assets")
    if os.path.isdir(local_assets_dir):
        local_assets = set(os.listdir(local_assets_dir))
        try:
            for item in sftp.listdir(remote_assets_dir):
                if item not in local_assets:
                    remote_file = f"{remote_assets_dir}/{item}"
                    print(f"Removing obsolete asset: {remote_file}")
                    sftp.remove(remote_file)
        except Exception as e:
            print(f"Note: Could not clean assets dir: {e}")

    # Remove stale dist directory if present
    def remove_remote_dir(remote_path):
        try:
            for item in sftp.listdir(remote_path):
                subpath = f"{remote_path}/{item}"
                try:
                    sftp.remove(subpath)
                except IOError:
                    remove_remote_dir(subpath)
            sftp.rmdir(remote_path)
            print(f"Removed stale directory: {remote_path}")
        except Exception:
            pass
    remove_remote_dir(f"{REMOTE_BASE}/wwwroot/dist")

    # Bring app back online
    try:
        sftp.remove(offline_file)
        print("Removed app_offline.htm - app is back online!")
    except IOError:
        pass

    sftp.close()
    transport.close()
    print("\nAll files uploaded successfully!")

if __name__ == "__main__":
    main()
