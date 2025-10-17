-- Seed Reference Data for MCGrocer Dashboard Testing
-- Run this in Supabase SQL Editor if the Node.js script fails

-- Seed Categories
INSERT INTO categories (name, description, level, is_active) VALUES
('Food & Beverages', 'Food, drinks, and grocery items', 1, true),
('Health & Beauty', 'Healthcare and beauty products', 1, true),
('Home & Garden', 'Home improvement and gardening', 1, true),
('Electronics', 'Electronic devices and accessories', 1, true),
('Clothing & Apparel', 'Clothing and fashion items', 1, true),
('Sports & Outdoors', 'Sports equipment and outdoor gear', 1, true),
('Toys & Games', 'Toys, games, and entertainment', 1, true),
('Books & Media', 'Books, movies, and media', 1, true),
('Pet Supplies', 'Pet food and accessories', 1, true),
('Baby & Kids', 'Baby and children products', 1, true)
ON CONFLICT (id) DO NOTHING;

-- Seed SEO Keywords
INSERT INTO seo_keywords (keyword, category, priority, is_active) VALUES
('organic', 'general', 10, true),
('natural', 'general', 8, true),
('premium', 'general', 5, true),
('eco-friendly', 'general', 7, true),
('sustainable', 'general', 6, true),
('handmade', 'general', 4, true),
('luxury', 'general', 9, true),
('best', 'general', 10, true),
('top rated', 'general', 8, true),
('professional', 'general', 7, true)
ON CONFLICT (id) DO NOTHING;

-- Seed Agent Resources
INSERT INTO agent_resource (agent_type, resource_type, title, content, is_active, version) VALUES
('category', 'guideline', 'Category Mapping Guidelines', 'Map products to the most specific category available. Consider product type, use case, and target audience.', true, 1),
('weight_dimension', 'guideline', 'Weight & Dimension Estimation', 'Estimate weight and dimensions based on product images and descriptions. Use industry standards for similar products.', true, 1),
('seo', 'guideline', 'SEO Optimization Guidelines', 'Create SEO-friendly titles and descriptions. Include relevant keywords naturally. Focus on user intent.', true, 1)
ON CONFLICT (id) DO NOTHING;

-- Verify insertions
SELECT 'Categories' as table_name, COUNT(*) as row_count FROM categories
UNION ALL
SELECT 'SEO Keywords', COUNT(*) FROM seo_keywords
UNION ALL
SELECT 'Agent Resources', COUNT(*) FROM agent_resource;
