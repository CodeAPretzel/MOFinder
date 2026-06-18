#!/bin/bash

set -euo pipefail

OPENVPN_CA_DIR="$HOME/openvpn-ca"
EASYRSA="$OPENVPN_CA_DIR/easyrsa"
PKI_DIR="$OPENVPN_CA_DIR/pki"
TLS_AUTH_KEY="$OPENVPN_CA_DIR/ta.key"

# Find next available client number
max=0
for file in "$OPENVPN_CA_DIR"/clients/client*.ovpn; do
[[ -e "$file" ]] || continue

filename=${file##*/}
num=${filename#client}
num=${num%.ovpn}

[[ "$num" =~ ^[0-9]+$ ]] || continue

(( num > max )) && max=$num

done

CLIENT_NUM=$((max + 1))
CLIENT_NAME="client${CLIENT_NUM}"

cd "$OPENVPN_CA_DIR"

# Generate private key + CSR
"$EASYRSA" gen-req "$CLIENT_NAME" nopass

# Sign certificate
yes yes | "$EASYRSA" sign-req client "$CLIENT_NAME"

# Verify expected files exist
CERT_FILE="$PKI_DIR/issued/${CLIENT_NAME}.crt"
KEY_FILE="$PKI_DIR/private/${CLIENT_NAME}.key"

OVPN_FILE="$OPENVPN_CA_DIR/clients/${CLIENT_NAME}.ovpn"

cat > "$OVPN_FILE" <<EOF
client
dev tun
proto udp
remote 128.252.127.30 1194
resolv-retry infinite
nobind
persist-key
persist-tun

cipher AES-256-GCM
auth SHA256
key-direction 1
remote-cert-tls server

verb 3

<ca>
$(cat "$PKI_DIR/ca.crt")
</ca>

<cert>
$(cat "$CERT_FILE")
</cert>

<key>
$(cat "$KEY_FILE")
</key>

<tls-auth>
$(cat "$TLS_AUTH_KEY")
</tls-auth>
EOF

echo "Created: $OVPN_FILE"
