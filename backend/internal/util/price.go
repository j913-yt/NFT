// 本文件负责 ETH 与 wei 之间的价格转换；合约交互必须使用 wei 整数字符串，不能直接用 float。
package util

import (
	"errors"
	"math/big"
	"strconv"
	"strings"
)

// weiBase 是 1 ETH 对应的 wei 数量：10^18。
var weiBase = new(big.Int).Exp(big.NewInt(10), big.NewInt(18), nil)

// NormalizeWeiString 校验并规范化 wei 字符串，只允许非负整数字符。
func NormalizeWeiString(raw string) (string, error) {
	// v 是去掉首尾空白后的原始 wei 文本。
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

// MustNormalizeWeiString 是容错版规范化，失败时返回 "0"，常用于历史数据修正。
func MustNormalizeWeiString(raw string) string {
	// v 是规范化后的结果，err 不为空说明 raw 不是合法 wei 字符串。
	v, err := NormalizeWeiString(raw)
	if err != nil {
		return "0"
	}
	return v
}

// IsPositiveWei 判断 wei 字符串是否是大于 0 的合法价格。
func IsPositiveWei(raw string) bool {
	// v 是规范化后的 wei；"0" 表示未上架或无有效价格。
	v, err := NormalizeWeiString(raw)
	if err != nil {
		return false
	}
	return v != "0"
}

// DisplayETHFromWeiString 把 wei 字符串转成 ETH 小数，只用于页面展示。
func DisplayETHFromWeiString(raw string) float64 {
	// v 是合法 wei 字符串；无效值会返回 0，避免展示层崩溃。
	v, err := NormalizeWeiString(raw)
	if err != nil {
		return 0
	}
	// intVal 是 wei 的大整数表示，避免大金额被 float 提前截断。
	intVal, ok := new(big.Int).SetString(v, 10)
	if !ok {
		return 0
	}

	// num/den 使用高精度 big.Float 做除法，最后才转成展示用 float64。
	num := new(big.Float).SetPrec(256).SetInt(intVal)
	den := new(big.Float).SetPrec(256).SetInt(weiBase)
	value, _ := new(big.Float).Quo(num, den).Float64()
	return value
}

// WeiStringFromETHFloat 把历史的 ETH float 价格转换成 wei 字符串。
func WeiStringFromETHFloat(value float64) (string, error) {
	if value <= 0 {
		return "0", nil
	}

	// text 固定保留 18 位小数，对应 ETH 到 wei 的最小精度。
	text := strconv.FormatFloat(value, 'f', 18, 64)
	// rat 用有理数表示 ETH 金额，减少直接 float 乘法带来的误差。
	rat, ok := new(big.Rat).SetString(text)
	if !ok {
		return "", errors.New("invalid ETH amount")
	}
	rat.Mul(rat, new(big.Rat).SetInt(weiBase))

	// out 是最终向下取整后的 wei 整数。
	out := new(big.Int).Quo(rat.Num(), rat.Denom())
	return out.String(), nil
}

// ResolveWeiAndDisplay 同时得到精确 wei 和展示 ETH；优先相信前端传来的 priceWei。
func ResolveWeiAndDisplay(priceWei string, fallbackETH float64) (string, float64, error) {
	// normalizedWei 是前端或数据库已有的 wei 字符串，非 0 时直接使用。
	normalizedWei, err := NormalizeWeiString(priceWei)
	if err == nil && normalizedWei != "0" {
		return normalizedWei, DisplayETHFromWeiString(normalizedWei), nil
	}

	// derivedWei 用旧的 ETH 小数字段推导，主要兼容历史数据或旧请求。
	derivedWei, err := WeiStringFromETHFloat(fallbackETH)
	if err != nil {
		return "", 0, err
	}
	return derivedWei, DisplayETHFromWeiString(derivedWei), nil
}
