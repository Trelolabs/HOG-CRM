import { Request, Response, NextFunction } from 'express';

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    const adminUser = process.env.CRM_ADMIN_USERNAME;
    const adminPass = process.env.CRM_ADMIN_PASSWORD;

    if (!adminUser || !adminPass) {
        return res.status(500).json({ error: 'Server auth configuration is incomplete' });
    }

    if (!authHeader || !authHeader.startsWith('Basic ')) {
        return res.status(401).json({ error: 'Access Denied: No credentials provided' });
    }

    const encodedCredentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(encodedCredentials, 'base64').toString().split(':');
    const [user, pass] = credentials;

    if (user === adminUser && pass === adminPass) {
        next();
    } else {
        return res.status(403).json({ error: 'Access Denied: Invalid credentials' });
    }
};
