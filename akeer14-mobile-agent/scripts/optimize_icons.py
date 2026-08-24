from pathlib import Path

from PIL import Image


SOURCE = Path("/home/ubuntu/webdev-static-assets/akeer14-agent-icon.png")
TARGETS = {
    "/home/ubuntu/akeer14-mobile-agent/assets/images/icon.png": 512,
    "/home/ubuntu/akeer14-mobile-agent/assets/images/splash-icon.png": 512,
    "/home/ubuntu/akeer14-mobile-agent/assets/images/favicon.png": 192,
    "/home/ubuntu/akeer14-mobile-agent/assets/images/android-icon-foreground.png": 432,
}


def main() -> None:
    with Image.open(SOURCE) as source:
        image = source.convert("RGBA")
        for raw_target, size in TARGETS.items():
            target = Path(raw_target)
            rendered = image.resize((size, size), Image.Resampling.LANCZOS)
            rendered.save(target, "PNG", optimize=True, compress_level=9)
            print(f"{target.name}={target.stat().st_size}")


if __name__ == "__main__":
    main()
