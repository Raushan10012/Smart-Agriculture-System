import http.server
import socketserver
import json
import socket
import os
import urllib.parse

PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

# In-memory session registry for mobile camera bridge
sessions_state = {}
sessions_photos = {}

def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = '127.0.0.1'
    finally:
        s.close()
    return ip

LOCAL_IP = get_local_ip()

class AgriHttpHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        # Enable CORS for cross-origin and local network calls
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(parsed.query)

        # API: Return local network info so frontend knows PC's Wi-Fi IP
        if parsed.path == '/api/network-info':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            resp = {
                'status': 'ok',
                'ip': LOCAL_IP,
                'port': PORT,
                'baseUrl': f'http://{LOCAL_IP}:{PORT}'
            }
            self.wfile.write(json.dumps(resp).encode('utf-8'))
            return

        # API: Desktop polls for mobile camera status and incoming photos
        if parsed.path == '/api/poll-session':
            session_id = params.get('session', [''])[0]
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()

            state = sessions_state.get(session_id, {
                'connected': False,
                'permission': False
            })

            photo_data = sessions_photos.pop(session_id, None)

            resp = {
                'status': 'ok',
                'session': session_id,
                'connected': state.get('connected', False),
                'permission': state.get('permission', False),
                'photo': photo_data
            }
            self.wfile.write(json.dumps(resp).encode('utf-8'))
            return

        # Default: Serve static files
        super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        content_length = int(self.headers.get('Content-Length', 0))
        post_body = self.rfile.read(content_length)

        try:
            payload = json.loads(post_body.decode('utf-8'))
        except Exception:
            payload = {}

        # API: Mobile phone sends captured photo to desktop
        if parsed.path == '/api/upload-photo':
            session_id = payload.get('session', '')
            data_url = payload.get('dataUrl', '')
            source = payload.get('source', 'Connected Smartphone')

            if session_id and data_url:
                sessions_photos[session_id] = {
                    'dataUrl': data_url,
                    'source': source
                }
                sessions_state[session_id] = {
                    'connected': True,
                    'permission': True
                }

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'success'}).encode('utf-8'))
            return

        # API: Mobile phone notifies connection or permission events
        if parsed.path == '/api/notify-status':
            session_id = payload.get('session', '')
            event_type = payload.get('type', '')

            if session_id:
                curr = sessions_state.setdefault(session_id, {'connected': False, 'permission': False})
                if event_type == 'DEVICE_CONNECTED':
                    curr['connected'] = True
                elif event_type == 'PERMISSION_GRANTED':
                    curr['connected'] = True
                    curr['permission'] = True

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'success'}).encode('utf-8'))
            return

        # Fallback 404
        self.send_response(404)
        self.end_headers()

if __name__ == '__main__':
    # Allow port reuse to prevent WinError 10048
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(('', PORT), AgriHttpHandler) as httpd:
        print('=' * 65)
        print('  SmartAgri Mobile Camera Bridge & Web Server Started!')
        print(f'  PC Web App:            http://localhost:{PORT}/index.html')
        print(f'  Mobile Wi-Fi Scanner:  http://{LOCAL_IP}:{PORT}/scanner-mobile.html')
        print(f'  Disease Scanner:       http://localhost:{PORT}/disease-detection.html')
        print('=' * 65)
        print('Server running on port 8000. Press Ctrl+C to stop.')
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print('\nServer stopped.')
