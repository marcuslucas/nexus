import os


class Config:
    FLASK_PORT = int(os.environ.get('FLASK_PORT', 5199))
    NEXUS_PRODUCT = os.environ.get('NEXUS_PRODUCT', 'unknown')
    CORE_DB_PATH = os.environ.get('CORE_DB_PATH')
    # Module DB paths — None if not set (module errors gracefully if accessed without config)
    WEB_MANAGER_DB_PATH = os.environ.get('WEB_MANAGER_DB_PATH')
    SOL_QUOTER_DB_PATH = os.environ.get('SOL_QUOTER_DB_PATH')
    PRODUCT_DB_PATH = os.environ.get('PRODUCT_DB_PATH')
