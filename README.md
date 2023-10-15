## Single Page Application (SPA) Cloud Architecture 

![Single Page Application Cloud Architecture](/assets/static-website-infra.png)

### Overview 

This cloud infrastructure is centered around four major components: **Route 53** for DNS management, **CloudFront** to serve static assets, **AWS Certificate Manager** for TLS/SSL certificates, and **Simple Storage Service** (S3) to store these assets.


#### Pre-requisites 
1. Register a new domain name with AWS Route 53
2. Request an ACM Certificate associated with your Route 53 domain name
3. Create CNAME records for the ACM Certificate through ACM Certificate AWS console
4. Install and configure the AWS CLI
5. Install and bootstrap the CDK CLI


> NOTE: Requesting an ACM SSL/TLS Certificate can take around 30 minutes or more
### Exporting environment variables 

Create an `.env` file and add the following environment variables listed in the `.env.example` file:
```sh
DOMAIN_NAME='example.com'
SUBDOMAIN='www'
ROUTE_53_HOSTED_ZONE_ID='example.com hosted zone id'
CERTIFICATE_ARN='ACM certificate ARN for example.com'
```

### Deploying the infrastructure 

Verify all there are no errors
```sh
cdk synth 
```

Deploy CDK infrastructure 
```sh
cdk deploy 
```

Delete infrastructure 
```sh 
cdk destroy
```