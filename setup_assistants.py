import os


def main():
    print("JANUS setup is now env-driven.")
    print(f"K2_API_KEY configured: {'yes' if bool(os.getenv('K2_API_KEY')) else 'no'}")
    print(f"OPENAI_API_KEY configured: {'yes' if bool(os.getenv('OPENAI_API_KEY')) else 'no'}")


if __name__ == "__main__":
    main()
