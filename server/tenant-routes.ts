
import { Express } from 'express';
import { tenantManager } from './tenant-manager';

export function registerTenantRoutes(app: Express) {
  // Admin routes for tenant management (should be protected)
  app.get('/admin/tenants', async (req, res) => {
    try {
      const tenants = tenantManager.getAllTenants();
      res.json(tenants);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch tenants' });
    }
  });

  app.post('/admin/tenants', async (req, res) => {
    try {
      const { subdomain, databaseUrl, storeName } = req.body;
      
      if (!subdomain || !databaseUrl || !storeName) {
        return res.status(400).json({ 
          error: 'Missing required fields: subdomain, databaseUrl, storeName' 
        });
      }

      const tenantConfig = {
        subdomain,
        databaseUrl,
        storeName,
        isActive: true
      };

      tenantManager.addTenant(tenantConfig);
      res.status(201).json({ message: 'Tenant created successfully', tenant: tenantConfig });
    } catch (error) {
      res.status(500).json({ error: 'Failed to create tenant' });
    }
  });

  app.delete('/admin/tenants/:subdomain', async (req, res) => {
    try {
      const { subdomain } = req.params;
      tenantManager.removeTenant(subdomain);
      res.json({ message: 'Tenant removed successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to remove tenant' });
    }
  });

  // Health check endpoint for tenant
  app.get('https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/tenant/info', async (req: any, res) => {
    try {
      if (!req.tenant) {
        return res.status(400).json({ error: 'No tenant information' });
      }

      res.json({
        subdomain: req.tenant.subdomain,
        storeName: req.tenant.config.storeName,
        isActive: req.tenant.config.isActive
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get tenant info' });
    }
  });
}
