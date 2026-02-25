import httpx
import asyncio
import sys

async def main():
    async with httpx.AsyncClient() as client:
        for port in [18080, 28080, 8080, 28888, 8888]:
            try:
                url = f"http://10.37.91.104:{port}/4,0ed212b3f0"
                r = await client.get(url, timeout=2.0)
                print(f"Port {port}: {r.status_code}")
                if r.status_code == 200:
                    print("CONTENT:", r.content)
            except Exception as e:
                print(f"Port {port}: error {e}")
                
        # Also try via master url? master doesn't serve files, only assigns.
        
asyncio.run(main())
