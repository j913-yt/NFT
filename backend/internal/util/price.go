package util

import (
	"errors"
	"math/big"
	"strconv"
	"strings"
)

var weiBase = new(big.Int).Exp(big.NewInt(10), big.NewInt(18), nil)

func NormalizeWeiString(raw string) (string, error) {
	v := strings.TrimSpace(raw)
	if v == "" {
		return "0", nil
	}
	for _, r := range v {
		if r < '0' || r > '9' {
			return "", errors.New("priceWei must be a non-negative integer string")
		}
	}
	v = strings.TrimLeft(v, "0")
	if v == "" {
		return "0", nil
	}
	return v, nil
}

func MustNormalizeWeiString(raw string) string {
	v, err := NormalizeWeiString(raw)
	if err != nil {
		return "0"
	}
	return v
}

func IsPositiveWei(raw string) bool {
	v, err := NormalizeWeiString(raw)
	if err != nil {
		return false
	}
	return v != "0"
}

func DisplayETHFromWeiString(raw string) float64 {
	v, err := NormalizeWeiString(raw)
	if err != nil {
		return 0
	}
	intVal, ok := new(big.Int).SetString(v, 10)
	if !ok {
		return 0
	}

	num := new(big.Float).SetPrec(256).SetInt(intVal)
	den := new(big.Float).SetPrec(256).SetInt(weiBase)
	value, _ := new(big.Float).Quo(num, den).Float64()
	return value
}

func WeiStringFromETHFloat(value float64) (string, error) {
	if value <= 0 {
		return "0", nil
	}

	text := strconv.FormatFloat(value, 'f', 18, 64)
	rat, ok := new(big.Rat).SetString(text)
	if !ok {
		return "", errors.New("invalid ETH amount")
	}
	rat.Mul(rat, new(big.Rat).SetInt(weiBase))

	out := new(big.Int).Quo(rat.Num(), rat.Denom())
	return out.String(), nil
}

func ResolveWeiAndDisplay(priceWei string, fallbackETH float64) (string, float64, error) {
	normalizedWei, err := NormalizeWeiString(priceWei)
	if err == nil && normalizedWei != "0" {
		return normalizedWei, DisplayETHFromWeiString(normalizedWei), nil
	}

	derivedWei, err := WeiStringFromETHFloat(fallbackETH)
	if err != nil {
		return "", 0, err
	}
	return derivedWei, DisplayETHFromWeiString(derivedWei), nil
}
