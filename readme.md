###Certificates
req.cnf
```txt
[req]
distinguished_name = req_distinguished_name
x509_extensions = v3_req
prompt = no
[req_distinguished_name]
C = SI
ST = VA
L = SomeCity
O = MyCompany
OU = MyDivision
CN = www.company.com
[v3_req]
keyUsage = critical, digitalSignature, keyAgreement
extendedKeyUsage = serverAuth
subjectAltName = @alt_names
[alt_names]
DNS = lukatavcer
```

- Create cert
```sh
openssl req -x509 -nodes -days 730 -newkey rsa:2048  -keyout cert.key -out cert.pem \
-config req.cnf -sha256
```

- Export as .pfx
 ```sh
openssl pkcs12 -export -in cert.pem -inkey cert.key -out novcert.pfx
or 
openssl pkcs12 -export -out domain.name.pfx -inkey domain.name.key -in domain.name.crt
 ``` 

- Convert to .key
 ```sh
openssl pkcs12 -in novcert.pfx -nocerts -nodes -out sample.key
openssl rsa -in sample.key -pubout -out sample_public.key
 ```
 
 - Get modulus and put it to profile
  ```sh
openssl rsa -pubin -in sample_public.key -text -noout -modulus
Modulus=BEEC8BBBB31117AAAC78A6ACC7BC3794194ECAD2BBFAA7E1E249EC66A4AFBCE19E60C40834938E97
475CA1C22E442E442B064BD764A4FF2CD165691383501FB4A96A115702EE80ED36A18E19AB69E6E566C67112
F51E0962FAD638C6894E56F25598394FDB7D905D86CF623B3750FBD5C0CABF6FA7592549870FEEFECFE89922
1C4B529328D649A5ECBF70B72D8BE5E5DCB8F0F2442FCCA70C50CFA9783B3A0D67CA0F969811A1D3874E2438
0858EFAE54C43FD1B1675585AB959328F1F399BAA93A19ACAE57753B2F6EDC5ABF7A0A6EB38AB417E4C04728
0DC8F6271C77D8B806A56C45D21950F063E13FCD98B71B84580B3481A847E849524C6EC4FB3D8A55
  ```
  
```txt
@prefix cert: <http://www.w3.org/ns/auth/cert#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
:me
    a schem:Person, n0:Person;
    n:fn "Luka Tav";
    n:hasAddress :id1563381668519;
    n:hasEmail :id1563381697478;
    n:role "Test";
    
    cert:key [ a cert:RSAPublicKey;
    cert:modulus "BEEC8BBBB31117AAAC78A6ACC7BC3794194ECAD2BBFAA7E1E...."^^xsd:hexBinary;
    cert:exponent 65537 ] .
```
