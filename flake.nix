{
    inputs = {
        nixpkgs.url = "github:nixos/nixpkgs/nixos-25.11";
    };

    outputs = { self, nixpkgs }:
        let
            pkgs = nixpkgs.legacyPackages.x86_64-linux;
        in {
            devShells.x86_64-linux.default = pkgs.mkShell {
                nativeBuildInputs = with pkgs; [
                    bun
                    nodejs_24
                ];
            };
        };
}
