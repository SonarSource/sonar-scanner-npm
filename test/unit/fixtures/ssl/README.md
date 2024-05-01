Use this to generate certificates:

```bash
# Cleanup
rm *.crt *.csr *.p12 *.key *.srl *.pem

# Create CA (private key)
openssl genrsa -out ca.key 4096

# Create the X.509 CA certificate
openssl req -key ca.key -new -x509 -days 3650 -sha256 -extensions ca_extensions -out ca.crt -config ./conf/openssl.conf

# Create self-signed certificate
openssl req -new -keyout server.key -out server.csr -nodes -newkey rsa:4096 -config ./conf/openssl.conf

# Sign with CA
openssl x509 -req -days 3650 -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out server.pem -sha256 -extfile conf/v3.ext
openssl x509 -in server.pem -text -noout # Verify

# Create truststores
keytool -import -trustcacerts -alias server-ca -keystore truststore.p12 -file ca.crt -noprompt -storepass password

# Export CA cert as PEM for test environment (use password "password")
openssl pkcs12 -storepass password -in truststore.p12 | sed -n -e '/BEGIN\ CERTIFICATE/,/END\ CERTIFICATE/ p' > ca.pem

# Create client certificate
openssl req -newkey rsa:4096 -nodes -keyout ca-client-auth.key -new -x509 -days 3650 -sha256 -extensions ca_extensions -out ca-client-auth.crt -subj '/C=CH/ST=Geneva/L=Geneva/O=SonarSource SA/CN=SonarSource/' -config ./conf/openssl-client-auth.conf
openssl req -new -keyout client.key -out client.csr -nodes -newkey rsa:4096 -subj '/C=CH/ST=Geneva/L=Geneva/O=SonarSource SA/CN=Julien Henry/' -config ./conf/openssl-client-auth.conf
openssl x509 -req -days 3650 -in client.csr -CA ca-client-auth.crt -CAkey ca-client-auth.key -CAcreateserial -out client.pem -sha256

# Create PKCS12 store containing the client certificate
openssl pkcs12 -export -in client.pem -inkey client.key -name theclient -out keystore.p12
```
