#!/usr/bin/env python3
"""wbi 签名测试 v2：带 buvid3 cookie 验证 acc/info + arc/search。"""
import hashlib
import http.cookiejar
import json
import time
import urllib.parse
import urllib.request

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
      "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36")

MIXIN_KEY_ENC_TAB = [46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45,
                     35, 27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38,
                     41, 13, 37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60,
                     51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36,
                     20, 34, 44, 52]

MID = 1340190821

cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
opener.addheaders = [("User-Agent", UA), ("Referer", "https://www.bilibili.com/")]


def get(url):
    return opener.open(url, timeout=15).read().decode("utf-8", "replace")


def bootstrap_cookies():
    # 拿 buvid3/buvid4
    spi = json.loads(get("https://api.bilibili.com/x/frontend/finger/spi"))
    b3, b4 = spi["data"]["b_3"], spi["data"]["b_4"]
    # 主动种 cookie（部分环境 spi 不带 Set-Cookie）
    from http.cookiejar import Cookie
    def make(name, value):
        return Cookie(version=0, name=name, value=value, port=None, port_specified=False,
                      domain=".bilibili.com", domain_specified=True, domain_initial_dot=True,
                      path="/", path_specified=True, secure=False,
                      expires=int(time.time()) + 3600 * 24 * 365, discard=False,
                      comment=None, comment_url=None, rest={}, rfc2109=False)
    cj.set_cookie(make("buvid3", b3))
    cj.set_cookie(make("buvid4", b4))
    # 再访问一下首页，拿 b_nut 等
    try:
        get("https://www.bilibili.com/")
    except Exception:
        pass
    return b3


def get_mixin_key():
    data = json.loads(get("https://api.bilibili.com/x/web-interface/nav"))
    wbi = data["data"]["wbi_img"]
    img_key = wbi["img_url"].rsplit("/", 1)[-1].split(".")[0]
    sub_key = wbi["sub_url"].rsplit("/", 1)[-1].split(".")[0]
    raw = img_key + sub_key
    return "".join(raw[i] for i in MIXIN_KEY_ENC_TAB)[:32]


def wbi_sign(params, mixin_key):
    params = dict(params)
    params["wts"] = int(time.time())
    query = urllib.parse.urlencode(sorted(params.items()))
    params["w_rid"] = hashlib.md5((query + mixin_key).encode()).hexdigest()
    return urllib.parse.urlencode(sorted(params.items()))


def main():
    b3 = bootstrap_cookies()
    print("buvid3:", b3)
    mixin_key = get_mixin_key()
    print("mixin_key:", mixin_key)

    q = wbi_sign({"mid": MID}, mixin_key)
    data = json.loads(get(f"https://api.bilibili.com/x/space/wbi/acc/info?{q}"))
    print("\n== acc/info == code:", data.get("code"), "message:", data.get("message"))
    if data.get("code") == 0:
        d = data["data"]
        print("mid:", d.get("mid"), "| name:", d.get("name"), "| fans:", d.get("fans"),
              "| official:", (d.get("official") or {}).get("title"))

    data = None
    for attempt in range(5):
        time.sleep(2)
        q = wbi_sign({"mid": MID, "ps": 30, "pn": 1, "order": "pubdate"}, mixin_key)
        data = json.loads(get(f"https://api.bilibili.com/x/space/wbi/arc/search?{q}"))
        if data.get("code") == 0:
            break
        print(f"  retry {attempt + 1}: code={data.get('code')} {data.get('message')}")
    print("\n== arc/search == code:", data.get("code"), "message:", data.get("message"))
    if data.get("code") == 0:
        lst = data["data"]["list"]["vlist"]
        page = data["data"]["page"]
        print(f"total videos: {page.get('count')} | this page: {len(lst)}")
        print("author:", lst[0].get("author"), "| mid in vlist:", lst[0].get("mid"))
        for v in lst[:5]:
            print(f"  bvid={v['bvid']} play={v['play']} pubdate={v['created']} title={v['title'][:40]}")
    else:
        print(str(data)[:500])


if __name__ == "__main__":
    main()
