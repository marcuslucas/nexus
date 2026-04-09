import os
import sys

# Allow running as `python run.py` from core/server/ or as `python core/server/run.py`
# from the project root — we need the nexus root on sys.path so `core` is importable.
_here = os.path.dirname(os.path.abspath(__file__))           # nexus/core/server
_root = os.path.abspath(os.path.join(_here, '..', '..'))     # nexus/
sys.path.insert(0, _root)

from core.server.app import create_app
from core.server.app.config import Config

app = create_app()

if __name__ == '__main__':
    port = Config.FLASK_PORT
    app.logger.info(f'Flask starting on port {port}')
    app.run(host='127.0.0.1', port=port, debug=False, use_reloader=False)
