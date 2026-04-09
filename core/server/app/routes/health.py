from datetime import datetime, timezone

from flask import Blueprint, jsonify

bp = Blueprint('health', __name__)


def _response(data=None, error=None, status=200):
    return jsonify({
        'data': data,
        'error': error,
        'timestamp': datetime.now(timezone.utc).isoformat(),
    }), status


@bp.route('/api/health', methods=['GET'])
def health():
    return _response(data={'status': 'ok', 'version': '1.0.0'})
