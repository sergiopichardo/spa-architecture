import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import { Construct } from 'constructs';

interface CertificateNestedStackProps extends cdk.NestedStackProps {
    certificateArn: string;
}

export default class CertificateNestedStack extends cdk.NestedStack {

    public certificate: acm.ICertificate;
    constructor(scope: Construct, id: string, props: CertificateNestedStackProps) {
        super(scope, id, props);

        this.certificate = this.importExistingCertificate(props.certificateArn);
    }

    private importExistingCertificate(certificateArn: string): acm.ICertificate {
        return acm.Certificate.fromCertificateArn(this, 'ImportedCertificate', certificateArn);
    }
}