/**
 * MariaDB/ERPNext Database Client
 *
 * TypeScript implementation of the MariaDB connection with SSH tunnel support
 * for accessing the ERPNext production database.
 */

import mysql from 'mysql2/promise'
import { Client as SSHClient } from 'ssh2'

interface DatabaseConfig {
  host: string
  database: string
  user: string
  password: string
  port: number
}

interface SSHTunnelConfig {
  host: string
  port: number
  username: string
  password: string
}

interface ProductRow {
  item_code: string
  item_name: string | null
  description: string | null
  item_group: string | null
  custom_website_breadcrumb: string | null
  brand: string | null
  modified: Date | null
  custom_product_url: string | null
}

export interface ERPNextProduct {
  itemCode: string
  itemName: string | null
  description: string | null
  itemGroup: string | null
  breadcrumb: any | null
  brand: string | null
  modified: Date | null
  productUrl: string | null
}

export interface FilterRule {
  id: string
  column: string
  operator: string
  value: string
}

class MariaDBClient {
  private sshClient: SSHClient | null = null
  private pool: mysql.Pool | null = null
  private localPort: number = 3307
  private isConnected: boolean = false

  private sshConfig: SSHTunnelConfig = {
    host: import.meta.env.VITE_ERPNEXT_SSH_HOST || '35.189.69.24',
    port: 22,
    username: import.meta.env.VITE_ERPNEXT_SSH_USER || 'root',
    password: import.meta.env.VITE_ERPNEXT_SSH_PASSWORD || '',
  }

  private dbConfig: DatabaseConfig = {
    host: 'localhost',
    database: import.meta.env.VITE_ERPNEXT_DATABASE || '_c8c4e2da668679ae',
    user: import.meta.env.VITE_ERPNEXT_DB_USER || 'root',
    password: import.meta.env.VITE_ERPNEXT_DB_PASSWORD || '',
    port: this.localPort,
  }

  /**
   * Establish SSH tunnel and database connection
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      return
    }

    return new Promise((resolve, reject) => {
      this.sshClient = new SSHClient()

      this.sshClient.on('ready', () => {
        console.log('SSH tunnel established')

        // Forward local port to remote MySQL
        this.sshClient!.forwardOut(
          '127.0.0.1',
          this.localPort,
          '127.0.0.1',
          3306,
          (err, stream) => {
            if (err) {
              reject(err)
              return
            }

            // Create MySQL connection pool through tunnel
            this.pool = mysql.createPool({
              host: this.dbConfig.host,
              port: this.dbConfig.port,
              user: this.dbConfig.user,
              password: this.dbConfig.password,
              database: this.dbConfig.database,
              waitForConnections: true,
              connectionLimit: 5,
              queueLimit: 0,
              enableKeepAlive: true,
              keepAliveInitialDelay: 0,
              stream: stream,
            })

            this.isConnected = true
            console.log('MariaDB connection pool created')
            resolve()
          }
        )
      })

      this.sshClient.on('error', (err) => {
        console.error('SSH tunnel error:', err)
        reject(err)
      })

      // Connect SSH
      this.sshClient.connect({
        host: this.sshConfig.host,
        port: this.sshConfig.port,
        username: this.sshConfig.username,
        password: this.sshConfig.password,
      })
    })
  }

  /**
   * Test database connectivity
   */
  async testConnection(): Promise<boolean> {
    if (!this.pool) {
      throw new Error('Database not connected. Call connect() first.')
    }

    try {
      const [rows] = await this.pool.execute('SELECT 1 as test')
      return Array.isArray(rows) && rows.length > 0
    } catch (error) {
      console.error('Connection test failed:', error)
      return false
    }
  }

  /**
   * Get total product count from ERPNext
   */
  async getTotalProductCount(filters: FilterRule[] = []): Promise<number> {
    if (!this.pool) {
      throw new Error('Database not connected. Call connect() first.')
    }

    try {
      const whereClause = this.buildWhereClause(filters)
      const query = `SELECT COUNT(*) as total FROM tabItem${whereClause.clause}`

      const [rows] = await this.pool.execute<mysql.RowDataPacket[]>(
        query,
        whereClause.params
      )
      return rows[0]?.total || 0
    } catch (error) {
      console.error('Error getting product count:', error)
      throw error
    }
  }

  /**
   * Build WHERE clause from filter rules
   */
  private buildWhereClause(filters: FilterRule[]): { clause: string; params: any[] } {
    if (!filters || filters.length === 0) {
      return { clause: '', params: [] }
    }

    const conditions: string[] = []
    const params: any[] = []

    for (const filter of filters) {
      const column = `item.${filter.column}`

      switch (filter.operator) {
        case '=':
          conditions.push(`${column} = ?`)
          params.push(filter.value)
          break
        case '≠':
          conditions.push(`${column} != ?`)
          params.push(filter.value)
          break
        case '>':
          conditions.push(`${column} > ?`)
          params.push(filter.value)
          break
        case '<':
          conditions.push(`${column} < ?`)
          params.push(filter.value)
          break
        case '>=':
          conditions.push(`${column} >= ?`)
          params.push(filter.value)
          break
        case '<=':
          conditions.push(`${column} <= ?`)
          params.push(filter.value)
          break
        case 'contains':
          conditions.push(`${column} LIKE ?`)
          params.push(`%${filter.value}%`)
          break
        case 'starts with':
          conditions.push(`${column} LIKE ?`)
          params.push(`${filter.value}%`)
          break
        case 'ends with':
          conditions.push(`${column} LIKE ?`)
          params.push(`%${filter.value}`)
          break
        case 'is null':
          conditions.push(`${column} IS NULL`)
          break
        case 'is not null':
          conditions.push(`${column} IS NOT NULL`)
          break
      }
    }

    if (conditions.length === 0) {
      return { clause: '', params: [] }
    }

    return {
      clause: ` WHERE ${conditions.join(' AND ')}`,
      params
    }
  }

  /**
   * Retrieve products batch from ERPNext
   */
  async getProductsBatch(
    offset: number = 0,
    limit: number = 50,
    filters: FilterRule[] = []
  ): Promise<ERPNextProduct[]> {
    if (!this.pool) {
      throw new Error('Database not connected. Call connect() first.')
    }

    const whereClause = this.buildWhereClause(filters)

    const query = `
      SELECT
        item.item_code,
        item.item_name,
        item.description,
        item.item_group,
        item.custom_website_breadcrumb,
        item.brand,
        item.modified,
        item_supplier.custom_product_url
      FROM tabItem AS item
      LEFT JOIN \`tabItem Supplier\` AS item_supplier
        ON item.name = item_supplier.parent
      ${whereClause.clause}
      ORDER BY item.item_code
      LIMIT ? OFFSET ?
    `

    try {
      const [rows] = await this.pool.execute<mysql.RowDataPacket[]>(
        query,
        [...whereClause.params, limit, offset]
      )

      return (rows as ProductRow[]).map((row) => ({
        itemCode: row.item_code,
        itemName: row.item_name,
        description: row.description,
        itemGroup: row.item_group,
        breadcrumb: row.custom_website_breadcrumb
          ? JSON.parse(row.custom_website_breadcrumb)
          : null,
        brand: row.brand,
        modified: row.modified,
        productUrl: row.custom_product_url,
      }))
    } catch (error) {
      console.error('Error fetching products batch:', error)
      throw error
    }
  }

  /**
   * Search products by name or item code
   */
  async searchProducts(
    searchTerm: string,
    limit: number = 50
  ): Promise<ERPNextProduct[]> {
    if (!this.pool) {
      throw new Error('Database not connected. Call connect() first.')
    }

    const query = `
      SELECT
        item.item_code,
        item.item_name,
        item.description,
        item.item_group,
        item.custom_website_breadcrumb,
        item.brand,
        item.modified,
        item_supplier.custom_product_url
      FROM tabItem AS item
      LEFT JOIN \`tabItem Supplier\` AS item_supplier
        ON item.name = item_supplier.parent
      WHERE
        item.item_code LIKE ? OR
        item.item_name LIKE ?
      ORDER BY item.item_code
      LIMIT ?
    `

    const searchPattern = `%${searchTerm}%`

    try {
      const [rows] = await this.pool.execute<mysql.RowDataPacket[]>(query, [
        searchPattern,
        searchPattern,
        limit,
      ])

      return (rows as ProductRow[]).map((row) => ({
        itemCode: row.item_code,
        itemName: row.item_name,
        description: row.description,
        itemGroup: row.item_group,
        breadcrumb: row.custom_website_breadcrumb
          ? JSON.parse(row.custom_website_breadcrumb)
          : null,
        brand: row.brand,
        modified: row.modified,
        productUrl: row.custom_product_url,
      }))
    } catch (error) {
      console.error('Error searching products:', error)
      throw error
    }
  }

  /**
   * Close database connection and SSH tunnel
   */
  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end()
      this.pool = null
    }

    if (this.sshClient) {
      this.sshClient.end()
      this.sshClient = null
    }

    this.isConnected = false
    console.log('MariaDB connection closed')
  }
}

// Singleton instance
let dbClient: MariaDBClient | null = null

/**
 * Get or create MariaDB client instance
 */
export async function getMariaDBClient(): Promise<MariaDBClient> {
  if (!dbClient) {
    dbClient = new MariaDBClient()
    await dbClient.connect()
  }
  return dbClient
}

/**
 * Helper function to get ERPNext products
 */
export async function getERPNextProducts(
  offset: number = 0,
  limit: number = 50,
  filters: FilterRule[] = []
): Promise<{ products: ERPNextProduct[]; total: number }> {
  const client = await getMariaDBClient()
  const [products, total] = await Promise.all([
    client.getProductsBatch(offset, limit, filters),
    client.getTotalProductCount(filters),
  ])

  return { products, total }
}
