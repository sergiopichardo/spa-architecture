import { Construct } from 'constructs'; 
import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as route53targets from 'aws-cdk-lib/aws-route53-targets'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as cloudfrontOrigins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as fs from 'fs';


interface SpaNestedStackProps extends cdk.NestedStackProps {
    cloudFrontFunctionPath: string;
    domainName: string;
    subdomain: string;
    hostedZoneId: string;
    buildAssetsPath: string;
}

export default class SpaNestedStack extends cdk.NestedStack {
    public distribution: cloudfront.IDistribution;

    constructor(scope: Construct, id: string, props: SpaNestedStackProps) {
        super(scope, id, props);

        // S3 
        const originBucket = this.createOriginBucket();
        this.createDeployment(originBucket, props.buildAssetsPath);
        
        const oai = this.createOriginAccessIdentity();
        const oaiPrincipal = this.createOriginAccessIdentityPrincipal(oai);
        this.grantPermissionsToOriginAccessIdentityPrincipal(originBucket, oaiPrincipal);

        if (!fs.existsSync(props.cloudFrontFunctionPath)) {
            throw new Error("A path to the CloudFront function must be provided")
        }

        const hostedZone = this.importHostedZone(props.domainName, props.hostedZoneId);

        const cloudFrontFunction = this.createCloudFrontFunction(props.cloudFrontFunctionPath);

        // const certificate = new acm.Certificate(this, 'SPACertificate', {
        //     domainName: props.domainName,
        //     subjectAlternativeNames: [`*.${props.domainName}`],
        //     validation: acm.CertificateValidation.fromDns(hostedZone)
        // })

        this.distribution = this.createDistribution(
            originBucket, 
            oai, 
            cloudFrontFunction,
            [props.domainName],
            // certificate
        );

        this.createARecord(hostedZone, this.distribution);

        this.createOutputs();
    }

    

    createOriginAccessIdentity() {
        return new cloudfront.OriginAccessIdentity(this, 'OriginAccessIdentity');
    }

    createOriginAccessIdentityPrincipal(originAccessIdentity: cloudfront.OriginAccessIdentity) {
        return new iam.CanonicalUserPrincipal(
            originAccessIdentity.cloudFrontOriginAccessIdentityS3CanonicalUserId
        )
    }

    grantPermissionsToOriginAccessIdentityPrincipal(
        originBucket: s3.IBucket,
        originAccessIdentityPrincipal: iam.CanonicalUserPrincipal
    ) {
        // Must explicitly create and attach policy because bucket is being imported
        const policyStatement = new iam.PolicyStatement({
            sid: 's3BucketPublicRead',
            effect: iam.Effect.ALLOW,
            actions: ['s3:GetObject'],
            principals: [originAccessIdentityPrincipal],
            resources: [`${originBucket.bucketArn}/*`]
        }); 

        // Manually create or update bucket policy
        // We do this because the autoCreatePolicy property will always be false for an imported S3 bucket. 
        // https://github.com/aws/aws-cdk/blob/4c7afb827b4005e337dd4635a80a7767bcec7b11/packages/%40aws-cdk/aws-s3/lib/bucket.ts#L971
        // So, we have to either create a new Bucket policy
        // or update the existing bucket policy by adding our policy statement that grants 
        // read access to the origin access identity.
        if(!originBucket.policy) {
            const bucketPolicy = new s3.BucketPolicy(this, 'Policy', { 
                bucket: originBucket 
            });

            bucketPolicy.document.addStatements(policyStatement);
        } else {
            originBucket.policy.document.addStatements(policyStatement);
        }
  
        originBucket.addToResourcePolicy(policyStatement);
    }

    createDistribution(
        originBucket: s3.IBucket, 
        originAccessIdentity: cloudfront.IOriginAccessIdentity,
        cloudFrontFunction: cloudfront.IFunction,
        domainNames: string[],
        // certificate: acm.ICertificate
    ) {
        return new cloudfront.Distribution(this, 'CloudFrontDistribution', {
            comment: "Single page application CloudFront distribution", 
            defaultRootObject: 'index.html',
            minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
            defaultBehavior: {
                origin: new cloudfrontOrigins.S3Origin(originBucket, {
                    originAccessIdentity: originAccessIdentity
                }),
                functionAssociations: [
                    {
                        eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
                        function: cloudFrontFunction
                    }
                ],
                compress: true,
                allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
                viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            },
            errorResponses: [
                {
                    ttl: cdk.Duration.minutes(30),
                    httpStatus: 403,
                    responseHttpStatus: 200,
                    responsePagePath: '/404.html'
                }
            ],
            domainNames: domainNames,
            // certificate: certificate,
        });
    }

    createCloudFrontFunction(cloudFrontFunctionPath: string) {
        return new cloudfront.Function(this, 'CloudFrontFunction', {
            code: cloudfront.FunctionCode.fromFile({ filePath: cloudFrontFunctionPath })
        });
    }

    importHostedZone(domainName: string, hostedZoneId: string) {
        return route53.HostedZone.fromHostedZoneAttributes(this, 'ImportedHostedZone', {
            hostedZoneId: hostedZoneId,
            zoneName: domainName,
        });
    }

    createARecord(
        hostedZone: route53.IHostedZone, 
        distribution: cloudfront.IDistribution,
    ): route53.ARecord {
        return new route53.ARecord(this, 'SPAAliasRecord', {
            zone: hostedZone,
            target: route53.RecordTarget.fromAlias(
                new route53targets.CloudFrontTarget(distribution)
            )
        });
    }

    createOriginBucket() {
        return new s3.Bucket(this, 'OriginBucket', {
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
            publicReadAccess: false,
        });
    }
    
    createDeployment(originBucket: s3.IBucket, buildAssetsPath: string) {
        new s3deploy.BucketDeployment(this, 'OriginDeployment', {
            sources: [s3deploy.Source.asset(buildAssetsPath)],
            destinationBucket: originBucket
        });
    }

    createOutputs() {
        new cdk.CfnOutput(this, 'CloudFrontDistributionURL', {
            description: "CloudFront distribution URL",
            value: `https://${this.distribution.distributionDomainName}`,
        })
    }
}