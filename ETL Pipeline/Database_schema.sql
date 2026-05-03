CREATE TABLE shops (
    id SERIAL PRIMARY KEY,
    shop_name VARCHAR(100) NOTNULL,
    location VARCHAR(100),
    shop_code VARCHAR(10) UNIQUE
);



CREATE TABLE shop_staff (
    id SERIAL PRIMARY KEY,
    staff_name VARCHAR(100) NOTNULL,
    role VARCHAR(50),
    shop_id INTREFERENCES shops(id)
);



CREATE TABLE product_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOTNULLUNIQUE
);



CREATE TABLE suppliers (
    id SERIAL PRIMARY KEY,
    company_name VARCHAR(100) NOTNULL,
    contact_person VARCHAR(100),
    email VARCHAR(100)
);



CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    email VARCHAR(100) UNIQUE,
    loyalty_tier VARCHAR(20) DEFAULT'Standard'
);



CREATE TABLE promotions (
    id SERIAL PRIMARY KEY,
    promo_name VARCHAR(100),
    discount_percent DECIMAL(5,2),
    is_active BOOLEANDEFAULTTRUE
);



CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    product_name VARCHAR(100) NOTNULL,
    category_id INTREFERENCES product_categories(id),
    supplier_id INTREFERENCES suppliers(id),
    unit_price DECIMAL(10,2) NOTNULL,
    cost_price DECIMAL(10,2) NOTNULL,
    unit_measure VARCHAR(10) DEFAULT'kg'
);



CREATE TABLE sales (
    id SERIAL PRIMARY KEY,
    shop_id INTREFERENCES shops(id),
    staff_id INTREFERENCES shop_staff(id),
    customer_id INTREFERENCES customers(id),
    promo_id INTREFERENCES promotions(id),
    payment_method VARCHAR(20),
    total_amount DECIMAL(10,2),
    created_at TIMESTAMPDEFAULTCURRENT_TIMESTAMP
);



CREATE TABLE sale_items (
    id SERIAL PRIMARY KEY,
    sale_id INTREFERENCES sales(id) ONDELETE CASCADE,
    product_id INTREFERENCES products(id),
    quantity DECIMAL(10,3),
    price_at_sale DECIMAL(10,2),
    discount_applied DECIMAL(10,2) DEFAULT0
);



CREATE TABLE inventory (
    id SERIAL PRIMARY KEY,
    shop_id INTREFERENCES shops(id),
    product_id INTREFERENCES products(id),
    stock_level DECIMAL(10,3),
    last_restock_date TIMESTAMPDEFAULTCURRENT_TIMESTAMP
);



CREATE TABLE wastage (
    id SERIAL PRIMARY KEY,
    shop_id INTREFERENCES shops(id),
    product_id INTREFERENCES products(id),
    quantity_wasted DECIMAL(10,3),
    reason VARCHAR(100),
    created_at TIMESTAMPDEFAULTCURRENT_TIMESTAMP
);