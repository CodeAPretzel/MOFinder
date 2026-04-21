#!/bin/bash


###
### Note, ensure you set variables accordingly.
###


CLIENT_NAME=$1
EASYRSA_DIR= # Define paths based on your setup
KEYS_DIR= # Where you copied the server's ta.key and ca.crt

if [ -z "$CLIENT_NAME" ]; then
    echo "Usage: $0 <client_name>"
    exit 1
fi

cat <<EOF > ${CLIENT_NAME}.ovpn
client
dev tun
proto udp
remote YOUR_SERVER_IP_OR_DOMAIN 1194
resolv-retry infinite
nobind
persist-key
persist-tun
remote-cert-tls server
verb 3

<ca>
$(cat ${KEYS_DIR}/ca.crt)
</ca>

<cert>
$(cat ${EASYRSA_DIR}/issued/${CLIENT_NAME}.crt)
</cert>

<key>
$(cat ${EASYRSA_DIR}/private/${CLIENT_NAME}.key)
</key>

<tls-auth>
$(cat ${KEYS_DIR}/ta.key)
</tls-auth>
EOF
