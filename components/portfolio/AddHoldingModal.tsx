import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../../constants/Colors';
import { AssetCategory } from '../../types/portfolio';
import { usePortfolio } from '../../contexts/PortfolioContext';

interface AddHoldingModalProps {
  visible: boolean;
  onClose: () => void;
}

export function AddHoldingModal({ visible, onClose }: AddHoldingModalProps) {
  const { addHolding, validateTicker } = usePortfolio();
  const [ticker, setTicker] = useState('');
  const [category, setCategory] = useState<AssetCategory>('미국주식');
  const [quantity, setQuantity] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const categories: AssetCategory[] = [
    'ETF',
    '한국주식',
    '미국주식',
    '코인',
    '실물자산',
  ];

  // 카테고리별 통화 결정
  const getInputCurrency = (): string => {
    switch (category) {
      case '한국주식':
      case '실물자산':
        return 'KRW';
      case '미국주식':
      case 'ETF':
      case '코인':
        return 'USD';
      default:
        return 'KRW';
    }
  };

  // 입력 통화를 KRW로 환산
  const convertToKRW = (price: number): number => {
    const currency = getInputCurrency();
    if (currency === 'KRW') {
      return price;
    }
    // USD → KRW 환율 (대략 1,350원, 실시간 시세 조회 시 정확한 환율 적용)
    return price * 1350;
  };

  const handleSubmit = async () => {
    console.log('handleSubmit called');

    // 입력값 검증
    if (!ticker || !quantity || !purchasePrice) {
      console.log('Missing fields');
      Alert.alert('오류', '모든 필드를 입력해주세요.');
      return;
    }

    const quantityNum = parseFloat(quantity);
    const priceNum = parseFloat(purchasePrice);

    console.log('Values:', { ticker, quantityNum, priceNum });

    if (isNaN(quantityNum) || quantityNum <= 0) {
      Alert.alert('오류', '유효한 수량을 입력해주세요.');
      return;
    }

    if (isNaN(priceNum) || priceNum <= 0) {
      Alert.alert('오류', '유효한 매수가를 입력해주세요.');
      return;
    }

    // 간단한 검증: 티커 길이만 체크
    if (ticker.length < 1 || ticker.length > 10) {
      Alert.alert('오류', '유효한 티커 심볼을 입력해주세요.');
      return;
    }

    console.log('Proceeding with add...');
    // 바로 추가 (검증 스킵)
    await proceedWithAdd();
  };

  const proceedWithAdd = async () => {
    console.log('proceedWithAdd called');
    const quantityNum = parseFloat(quantity);
    const priceNum = parseFloat(purchasePrice);
    const priceInKRW = convertToKRW(priceNum);

    console.log(`Converting ${priceNum} ${getInputCurrency()} → ${priceInKRW} KRW`);

    setIsSubmitting(true);
    try {
      console.log('Calling addHolding...');
      await addHolding({
        ticker: ticker.toUpperCase(),
        category,
        quantity: quantityNum,
        purchasePrice: priceInKRW,
        purchaseDate: new Date(),
      });

      console.log('Holding added successfully!');

      // 폼 초기화
      setTicker('');
      setQuantity('');
      setPurchasePrice('');
      onClose();

      Alert.alert('성공! 🎉', '보유 자산이 추가되었습니다!\n\n홈 화면에서 새로고침하면 실시간 시세를 불러옵니다.');
    } catch (error) {
      console.error('Add holding error:', error);
      Alert.alert('오류', `자산 추가에 실패했습니다.\n\n오류: ${JSON.stringify(error)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isValidating && !isSubmitting) {
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>자산 추가</Text>
            <TouchableOpacity
              onPress={handleClose}
              disabled={isValidating || isSubmitting}
            >
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollView}>
            <View style={styles.form}>
              {/* 티커 입력 */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>티커 심볼</Text>
                <TextInput
                  style={styles.input}
                  value={ticker}
                  onChangeText={setTicker}
                  placeholder="AAPL, 005930.KS"
                  placeholderTextColor={Colors.textSecondary}
                  autoCapitalize="characters"
                  editable={!isValidating && !isSubmitting}
                />
                <Text style={styles.hint}>
                  미국: AAPL, 한국: 005930.KS, ETF: SPY
                </Text>
              </View>

              {/* 카테고리 선택 */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>카테고리</Text>
                <View style={styles.categoryGrid}>
                  {categories.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.categoryButton,
                        category === cat && styles.categoryButtonActive,
                      ]}
                      onPress={() => setCategory(cat)}
                      disabled={isValidating || isSubmitting}
                    >
                      <Text
                        style={[
                          styles.categoryText,
                          category === cat && styles.categoryTextActive,
                        ]}
                      >
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* 수량 입력 */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>수량</Text>
                <TextInput
                  style={styles.input}
                  value={quantity}
                  onChangeText={setQuantity}
                  placeholder="10"
                  placeholderTextColor={Colors.textSecondary}
                  keyboardType="decimal-pad"
                  editable={!isValidating && !isSubmitting}
                />
              </View>

              {/* 매수가 입력 */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  매수가 ({getInputCurrency()})
                </Text>
                <TextInput
                  style={styles.input}
                  value={purchasePrice}
                  onChangeText={setPurchasePrice}
                  placeholder={getInputCurrency() === 'KRW' ? '50000' : '150'}
                  placeholderTextColor={Colors.textSecondary}
                  keyboardType="decimal-pad"
                  editable={!isValidating && !isSubmitting}
                />
                <Text style={styles.hint}>
                  {getInputCurrency() === 'KRW'
                    ? '단위당 매수 가격 (원화)'
                    : '단위당 매수 가격 (달러, 자동으로 원화 환산됩니다)'}
                </Text>
              </View>

              {/* 제출 버튼 */}
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  (isValidating || isSubmitting) && styles.submitButtonDisabled,
                ]}
                onPress={handleSubmit}
                disabled={isValidating || isSubmitting}
              >
                {isValidating || isSubmitting ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={Colors.text} />
                    <Text style={styles.submitButtonText}>
                      {isValidating ? '티커 검증 중...' : '추가 중...'}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.submitButtonText}>추가하기</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(107, 79, 255, 0.2)',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
  },
  scrollView: {
    flex: 1,
  },
  form: {
    padding: 24,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.cardBackground,
    borderWidth: 1,
    borderColor: 'rgba(107, 79, 255, 0.3)',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: Colors.text,
  },
  hint: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 6,
    opacity: 0.7,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(107, 79, 255, 0.3)',
    backgroundColor: Colors.cardBackground,
  },
  categoryButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  categoryText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  categoryTextActive: {
    color: Colors.text,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: Colors.primary,
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
});
